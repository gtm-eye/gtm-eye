const fs = require('fs');
const crypto = require('crypto');

const path = require('path');
const { execSync } = require('child_process');

const GALLERY_URL = "https://tagmanager.google.com/api/gallery/templates"; // URL to fetch gallery templates
const GTAG_SCRIPTS = ["www.googletagmanager.com/gtag"]; // URLs for GTAG scripts
const OFFICIAL_TAGS_FILE = "./official_tags.json"
const ASSET_DIRECTORY = '../public/assets'

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

// Function to hash a JSON object using SHA-256, WARN verify JSON KEY ORDER
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
        if (p.instance.param !== undefined) {
            p.instance.param.forEach((par, i) => {
                const keyPar = par.key;
                const typePar = par.value.type;
                if (typePar === 1) {
                    if (i === 0 || keyPar !== "queriesAllowed") {
                        permsObject[key][keyPar] = par.value.string;
                    }
                } else if (typePar === 2) {
                    // Handle lists of strings, booleans, or JSON objects
                    if (par.value.listItem[0].type === 1) {
                        permsObject[key][keyPar] = par.value.listItem.map(i => i.string);
                    } else if (par.value.listItem[0].type === 3) {
                        permsObject[key][keyPar] = par.value.listItem.map(i => {
                            const object = {};
                            const keys = i.mapKey.map(k => k.string);
                            const values = i.mapValue.map(v => v.type === 1 ? v.string : v.boolean);
                            if (keys.length !== values.length) {
                                throw new Error("Parsing Error !");
                            }
                            for (let i = 0; i < keys.length; i++) {
                                object[keys[i]] = values[i];
                            }
                            return object;
                        });
                    } else if (par.value.listItem[0].type === 8) {
                        permsObject[key][keyPar] = par.value.listItem.map(i => i.boolean);
                    }
                } else if (typePar === 8) {
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

    //for an experiment on the 2025-04-28
    console.log("THE SCRIPT WILL ONLY KEEP TEMPLATE TAGS VERSIONS THAT WERE UPDATED BEFORE THE 2025-04-28")

    permsList = permsList.filter(perm => {
        let a = new Date(perm.date).getTime() 
        let b = new Date("2025-04-28").getTime() 

        return a < b
    })
    

    permsList.sort((perma, permb) => { //sorting so the most recent date is kept
        let a = new Date(perma.date).getTime()
        let b = new Date(permb.date).getTime()
        return b-a
    })

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


// Function to generate permissions for all github versions of a gallery tag and handle errors
async function genTagPermissions(tag) {
    const tagName = tag.properties.displayName.text[0].value;
    // const refs = tag.properties.versions.filter(v => v.updateError == undefined || v.updateError === 0).map(v => v.sha);
    const permsList = [];
    const owner = tag.key.ownerName;
    const repo = tag.key.repositoryName;

    fs.mkdirSync(path.resolve(__dirname, 'repositories', owner), {recursive: true})

    execSync('git clone https://github.com/' + owner + '/' + repo + '.git', {
        stdio: [0, 1, 2], // we need this so node will print the command output
        cwd: path.resolve(__dirname, 'repositories', owner),
    })

    const commits = new TextDecoder().decode(execSync('git --no-pager log --pretty=format:"%H %cs"', {
        cwd: path.resolve(__dirname, 'repositories', owner, repo),
    }))

    commits.split('\n').forEach(commit => {
        let hash = commit.split(' ')[0]
        let date = commit.split(' ')[1]

        let gtmPerms = [];
        try{
            let tpl = new TextDecoder().decode(execSync(`git --no-pager show ${hash}:template.tpl`, {
                cwd: path.resolve(__dirname, 'repositories', owner, repo),
            }))
            let perms = extractPermissions(tpl);
            gtmPerms = genTagPermission(perms, tagName);
            
            permsList.push({ "perms": gtmPerms, "sha": hash, "date": date });
            console.log(`finished processing ${hash} of ${tagName}`);
        } catch {
            console.log(`hash ${hash} does not contain template.tpl`);
        }


    })


    console.log("finished processing", tagName);
    return uniquePerms(permsList);
}

// Function to generate the gallery map and permissions map
async function genGalleryMap() {
    const tagPermsMap = {};
    const galleryMap = {};
    const galleryTags = await getGalleryTags();

    //reset cloned repositories
    fs.rmdirSync(path.resolve(__dirname, 'repositories'), { recursive: true, force: true })
    fs.mkdirSync(path.resolve(__dirname, 'repositories'))

    // Sequential processing to avoid GitHub API rate limits
    for (const tag of galleryTags) {
        if (tag.properties.type === 1 && tag.properties.containerContext === 0) { //is a tag and is client side

            const type = "gallery"
            const name = tag.properties.displayName.text[0].value;
            const thumbnail = tag.properties.brand && tag.properties.brand.thumbnail ? tag.properties.brand.thumbnail.name : null;
            const description = tag.properties.description ? tag.properties.description.text[0].value : null;
            const brand = tag.properties.ownerName
            const repository = "https://github.com/" + tag.key.ownerName + "/" + tag.key.repositoryName;

            console.log("processing ", name);

            // Await genTagPermissions inside an async function
            const perms = await genTagPermissions(tag);

            // tagPermsMap aids in debugging
            tagPermsMap[name] = perms;

            const possibleTag = { type, name, thumbnail, description, brand, repository };

            perms.forEach(p => {
                
                const permsHash = hash(p.perms);
                const permissions = p.perms
                const potentialRequests = getScripts(p.perms);
                const commitSha = p.sha;
                const date = p.date
                const tagCopy = { ...possibleTag, permissions, potentialRequests, commitSha, date };
                if (galleryMap[permsHash]) {
                    galleryMap[permsHash].push(tagCopy);
                } else {
                    galleryMap[permsHash] = [tagCopy];
                }
            });

        } else {
            //server side tags and variables ...
        }
    }


    // Create JSON files for the generated maps
    fs.writeFileSync(ASSET_DIRECTORY + '/galleryTagsMap.json', JSON.stringify(galleryMap))
    fs.writeFileSync(ASSET_DIRECTORY + '/galleryTagsMap.debug.json', JSON.stringify(tagPermsMap))
}

// Function to generate the official tags map
function genOfficialTagsMap() {
    const tagsMap = {};

    const file = fs.readFileSync(OFFICIAL_TAGS_FILE, "utf-8")

    const officialTags = JSON.parse(file).default.vendorTemplateData

    officialTags.forEach(tag => {
        const tagFunction = "__" + tag.publicId;
        if (!tagsMap[tagFunction]) {

            if (tag.type === 1 && tag.containerContext.includes(0)) { //is a TAG and runs on the client side
                if (tag.isSystemOnly === undefined && tag.publicId !== "zone" && tag.brand.publicId !== "brand_eventlistener") { //only non system tags and non zone tag and non listner tags
                    const type = "official"
                    const name = tag.displayName ? tag.displayName.text[0].value : tagFunction;

                    let thumbnail = null
                    if (tag.brand) {
                        if (tag.brand.thumbnail)
                            thumbnail = tag.brand.thumbnail.text
                        else if (tag.brand.logo)
                            thumbnail = tag.brand.logo.text
                    }

                    const description = tag.description ? tag.description.text[0].value : null;
                    const permissions = genTagPermission(tag.webPermission);
                    let potentialRequests = getScripts(permissions)
                    const brand = tag.brand ? tag.brand.publicId : null;

                    if (tag.publicId === "googtag") {
                        potentialRequests = GTAG_SCRIPTS
                    }

                    tagsMap[tagFunction] = { type, name, description, thumbnail, permissions, brand, potentialRequests };
                } else { //system tags
                    const type = "system";
                    const name = tag.name;
                    const description = tag.description ? tag.description.text[0].value : null;

                    tagsMap[tagFunction] = { type, name, description };
                }
            } else { //is a server side tag
                //pass
            }
        } else {
            throw new Error("Duplicate Tag Function")
        }

    });
    // Create JSON file for the official tags map
    fs.writeFileSync(ASSET_DIRECTORY + '/officialTagsMap.json', JSON.stringify(tagsMap));
}


fs.readdirSync(ASSET_DIRECTORY).forEach(file => fs.unlinkSync(ASSET_DIRECTORY + "/" + file))
genOfficialTagsMap();
genGalleryMap();

