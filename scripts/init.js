const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const { officialTags } = require('../public/assets/officialTags.js');
const GITHUB_TOKEN = "to_replace"; // GitHub API token
const GITHUB_API = "https://api.github.com/repos" // GitHub api
const GITHUB_TEMPLATE = "contents/template.tpl" // Template path
const GALLERY_URL = "https://tagmanager.google.com/api/gallery/templates"; // URL to fetch gallery templates
const GTAG_SCRIPTS = ["www.googletagmanager.com/gtag"]; // URLs for GTAG scripts

// Function to create a file with the given path and map data
function createFile(filePath, map) {
    fs.writeFile(filePath, JSON.stringify(map), (err) => {
        if (err) {
            console.error('Erreur lors de l\'écriture du fichier :', err);
            return;
        }
        console.log(filePath, ' a été créé avec succès !');
    });
}

// Function to replace zero-width spaces with regular spaces
function replaceZeroWidthSpaces(input) {
    const regex = /\u200B/g;
    const output = input.replace(regex, ' ');
    return output;
}

// Function to clean JSON strings by removing trailing commas and escaped asterisks
function cleanJSON(jsonString) {
    return jsonString.replace(/,\s*([\]}])/g, '$1').replace(/\\\*/g, '*');
}

// Function to hash a JSON object using SHA-256
function hash(jsonObj) {
    try {
        const jsonString = JSON.stringify(jsonObj);
        const stringHash = crypto.createHash('sha256');
        stringHash.update(jsonString);
        return stringHash.digest('hex');
    } catch (error) {
        console.log(jsonObj);
        throw new Error(error);
    }
}

// Function to extract permissions from a template string
function extractPermissions(template) {
    const cleanTemplate = replaceZeroWidthSpaces(template);
    const match = cleanTemplate.match(/___WEB_PERMISSIONS___\s*(\[[\s\S]*?\])\s*___/);
    if (match && match[1]) {
        try {
            return JSON.parse(cleanJSON(match[1]));
        } catch (error) {
            throw new Error("Error parsing Permissions " + error);
        }
    }
    return [];
}

// Function to fetch gallery tags from the API
async function getGalleryTags() {
    const res = await fetch(GALLERY_URL);
    const response = await res.text();
    const jsonObj = JSON.parse(response.substring(response.indexOf('{')));
    return jsonObj.default.templates;
}

// Function to generate permissions object from permissions array
function genTagPermission(perms, tagName) {
    const permsObject = {};
    perms.forEach(p => {
        const key = p.instance.key.publicId;
        permsObject[key] = {};
        if (p.instance.param != undefined) {
            p.instance.param.forEach((par, i) => {
                const keyPar = par.key;
                const typePar = par.value.type;
                if (typePar == 1) {
                    if (i == 0 || keyPar != "queriesAllowed") {
                        permsObject[key][keyPar] = par.value.string;
                    }
                } else if (typePar == 2) {
                    // Handle lists of strings, booleans, or JSON objects
                    if (par.value.listItem[0].type == 1) {
                        permsObject[key][keyPar] = par.value.listItem.map(i => i.string);
                    } else if (par.value.listItem[0].type == 3) {
                        permsObject[key][keyPar] = par.value.listItem.map(i => {
                            const object = {};
                            const keys = i.mapKey.map(k => k.string);
                            const values = i.mapValue.map(v => v.type == 1 ? v.string : v.boolean);
                            if (keys.length !== values.length) {
                                throw new Error("Parsing Error !");
                            }
                            for (let i = 0; i < keys.length; i++) {
                                object[keys[i]] = values[i];
                            }
                            return object;
                        });
                    } else if (par.value.listItem[0].type == 8) {
                        permsObject[key][keyPar] = par.value.listItem.map(i => i.boolean);
                    }
                } else if (typePar == 8) {
                    permsObject[key][keyPar] = par.value.boolean;
                } else {
                    throw new Error(tagName + typePar);
                }
            });
        }
        // Handle specific Google modifications
        if (key == "read_data_layer") {
            if (Object.keys(permsObject[key]).length == 0) {
                permsObject[key] = { "allowedKeys": "specific" };
            } else if (permsObject[key]["keyPatterns"] != undefined) {
                permsObject[key] = { "allowedKeys": "specific", ...permsObject[key] };
            } else if (permsObject[key]["allowedKeys"] == undefined) {
                console.log("read_data_layer ERROR", tagName);
            }
        }
        if (key == "send_pixel") {
            if (Object.keys(permsObject[key]).length == 0) {
                permsObject[key] = { "allowedUrls": "specific" };
            } else if (permsObject[key]["urls"] != undefined) {
                permsObject[key] = { "allowedUrls": "specific", ...permsObject[key] };
            } else if (permsObject[key]["allowedUrls"] == undefined) {
                console.log("send_pixel ERROR", tagName);
            }
        }
        if (key == "get_cookies" && (permsObject[key]["cookieAccess"] == undefined)) {
            permsObject[key] = {};
        }
    });
    return permsObject;
}

// Function to remove duplicate permissions by hashing
function uniquePerms(permsList) {
    const uniquePermsList = [];
    const seenHashes = new Set();
    for (const p of permsList) {
        const hashValue = hash(p.perms);
        if (!seenHashes.has(hashValue)) {
            seenHashes.add(hashValue);
            uniquePermsList.push(p);
        }
    }
    return uniquePermsList;
}

// Function to get script URLs from tag permissions
function getScripts(tagPerms) {
    let scripts = [];
    const injectPerm = tagPerms.inject_script;
    if (injectPerm != undefined) {
        // Script injection
        scripts = (Object.keys(injectPerm).length == 0) ? [] : injectPerm.urls; // All URLs or specified URLs
    }
    return scripts;
}

// Function to generate a map of gallery tags with permissions
function genGalleryTagMap(galleryMap, perms, tag) {
    perms.forEach(p => {
        const permsHash = hash(p.perms);
        const tagInject = (p.perms.inject_script !== undefined);
        const tagScripts = getScripts(p.perms);
        const tagVersion = p.sha;
        const tagCopy = { ...tag, tagInject: tagInject, tagScripts: tagScripts, tagVersion: tagVersion };
        if (galleryMap[permsHash]) {
            galleryMap[permsHash].push(tagCopy);
        } else {
            galleryMap[permsHash] = [tagCopy];
        }
    });
}

// Function to generate permissions for all github versions of a gallery tag and handle errors
async function genTagPermissions(tag) {
    const tagName = tag.properties.displayName.text[0].value;
    const refs = tag.properties.versions.filter(v => v.updateError == undefined || v.updateError === 0).map(v => v.sha);
    const permsList = [];
    const owner = tag.key.ownerName;
    const repo = tag.key.repositoryName;
    for (const ref of refs) {
        let gtmPerms = [];
        try {
            let url = `${GITHUB_API}/${owner}/${repo}/${GITHUB_TEMPLATE}?ref=${ref}`;
            let response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`
                }
            });
            let res = response.data;
            let tpl = Buffer.from(res.content, 'base64').toString('utf-8');
            let perms = extractPermissions(tpl);
            gtmPerms = genTagPermission(perms, tagName);
        } catch (error) {
            let url = `${GITHUB_API}/${owner}/${repo}/${GITHUB_TEMPLATE}?ref=${ref}`;
            gtmPerms = { "notFound": true, "url": url };
            if (error.response) {
                gtmPerms["notFound"] = error.response.status;
            } else {
                console.log(tagName + error);
                process.exit(1);
            }
        }
        permsList.push({ "perms": gtmPerms, "sha": ref });
        console.log(`finished processing ${ref} of ${tagName}`);
    }
    console.log("finished processing", tagName);
    return uniquePerms(permsList);
}

// Function to generate the gallery map and permissions map
async function genGalleryMap() {
    const tagPermsMap = {};
    const galleryMap = {};
    const galleryTags = await getGalleryTags();
    // Sequential processing to avoid GitHub API rate limits
    for (const tag of galleryTags) {
        const tagName = tag.properties.displayName.text[0].value;
        console.log("processing ", tagName);
        // Await genTagPermissions inside an async function
        const perms = await genTagPermissions(tag);
        // tagPermsMap aids in debugging
        tagPermsMap[tagName] = perms;

        // Tag details
        const tagLogo = null;
        const tagTmb = tag.properties.brand ? tag.properties.brand.thumbnail : null;
        const tagDesc = tag.properties.description ? tag.properties.description.text[0].value : "N/A";
        const tagInject = false; // Updated in genGalleryTagMap
        const tagScripts = []; // Updated in genGalleryTagMap
        const tagRepo = "https://github.com/" + tag.key.ownerName + "/" + tag.key.repositoryName;
        const tagVersion = null; // Updated in genGalleryTagMap
        const possibleTag = { tagName, tagDesc, tagLogo, tagTmb, tagInject, tagScripts, tagRepo, tagVersion };

        // Update galleryMap with new tag permissions
        genGalleryTagMap(galleryMap, perms, possibleTag);
    }
    // Create JSON files for the generated maps
    createFile('../public/assets/galleryMap.json', galleryMap);
    createFile('../public/assets/galleryPermsMap.json', tagPermsMap);
}

// Function to generate the official tags map
function genOfficialTagsMap() {
    const tagsMap = {};
    officialTags.forEach(tag => {
        const tagFunction = "__" + tag.publicId;
        if (!tagsMap[tagFunction]) {
            const perms = genTagPermission(tag.webPermission);
            const tagName = tag.displayName ? tag.displayName.text[0].value : tagFunction;
            const tagLogo = tag.brand ? tag.brand.logo : null;
            const tagTmb = tag.brand ? tag.brand.thumbnail : null;
            const tagDesc = tag.description ? tag.description.text[0].value : "N/A";
            const tagInject = tagFunction == "__googtag" ? true : perms.inject_script !== undefined;
            const tagScripts = tagFunction == "__googtag" ? GTAG_SCRIPTS : getScripts(perms);
            const type = tag.type;
            const tagBrand = tag.brand ? tag.brand.publicId : null;
            const tests = tag.tests || {};
            tagsMap[tagFunction] = { tagName, tagDesc, tagLogo, tagTmb, tagInject, tagScripts, type, tagBrand, tests };
        }
    });
    // Create JSON file for the official tags map
    createFile('../public/assets/officialTagsMap.json', tagsMap);
}

// Initialize the process by generating maps for both official and gallery tags
function init() {
    genOfficialTagsMap();
    genGalleryMap();
}

init();
