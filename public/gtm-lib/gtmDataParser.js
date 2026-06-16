// Regular expression to extract scripts injection in HTML tags
export const INJECTION_REGEX = /(\/\/[^"?']+)/g;

// Function to compute a SHA-256 hash of a JSON object
export async function hashTag(jsonObj) {
  const json = JSON.stringify(jsonObj); // Convert JSON object to string
  const encoder = new TextEncoder(); // Create a TextEncoder instance
  const data = encoder.encode(json); // Encode the JSON string as bytes
  const hashBuffer = await crypto.subtle.digest('SHA-256', data); // Compute SHA-256 hash
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // Convert hash buffer to byte array
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // Convert byte array to hexadecimal string
  return hashHex;
}

// Function to correct the tag data by adding "allowedKeys" if missing
export function correct(tagData) {
  const key = "read_data_layer";
  if (tagData[key] != undefined && tagData[key]["keyPatterns"] != undefined && tagData[key]["allowedKeys"] == undefined) {
    tagData[key] = { "allowedKeys": "specific", ...tagData[key] };
  }
  return tagData;
}

// Function to get possible tags from a map based on the hashed tag data
export async function getPossibleTags(tagData, map) {
  const hash = await hashTag(correct(tagData)); // Compute the hash of the corrected tag data
  if (map[hash] != undefined) {
    return map[hash]; // Return the tags if the hash exists in the map
  }
  return []; // Return an empty array if no tags are found
}

// Function to find the runtime that matches a specific tag function
export function getRuntime(tagFunction, runtimes) {
  const runtime = runtimes.find(r => r[1] === tagFunction); // Find the runtime
  return runtime || null; // Return the runtime configuration or null if not found
}

// Function to get runtime scripts of a gallery Tag 
export function getRuntimeScripts(tagConfig, runtimes) {
  const runtime = getRuntime(tagConfig.function, runtimes); // Get the runtime
  if (runtime) {
    const runtimeString = JSON.stringify(runtime); // Convert runtime to string
    const matches = runtimeString.match(INJECTION_REGEX);
    if (matches && matches.length > 0) {
      return matches; // Return the matches
    }
  }
  return []; // Return an empty array if no scripts are found
}

// Function to get a list of script URLs based on permissions
export function getScripts(tagPerms) {
  let scripts = [];
  const injectPerm = tagPerms.inject_script;
  if (injectPerm != undefined) {
    // Check if injection permission is defined
    scripts = (Object.keys(injectPerm).length == 0) ? [] : injectPerm.urls; // Get the URLs or an empty array
  }
  return scripts;
}

// Function to set injected scripts from HTML code into the tag configuration
export function setHtmlInjectedScripts(htmlCode, tagConfig) {
  const matches = htmlCode.match(INJECTION_REGEX); // Find injected scripts
  if (matches && matches.length > 0) {
    tagConfig.inject_script = true; // Mark as script injection
    matches.forEach(url => tagConfig.injectedScripts.push(url)); // Add scripts to the configuration
  }
}

// Function to add a script to the scripts map with associated tag names
export function addScript(scriptsList, tagName, scriptsMap) {
  scriptsList.forEach(url => {
    let tagsList = scriptsMap[url];
    if (tagsList && !tagsList.includes(tagName)) {
      tagsList.push(tagName); // Add tag name to the list
    } else {
      scriptsMap[url] = [tagName]; // Initialize list with the tag name
    }
  });
}

// Function to get the tag configuration based on the tag and official tags map
export function getTagConfig(tag, tagsMap, scriptsMap) {
  const tagMap = tagsMap[tag.function];
  const tagConfig = {
    function: tag.function,
    isActive: true,
    tag: tagMap ? tagMap.tagName : null, // official or gallery
    description: tagMap ? tagMap.tagDesc : "Unofficial Tag",
    logo: tagMap ? tagMap.tagLogo : null,
    tmb: tagMap ? tagMap.tagTmb : null,
    collision: 1,
    official: true,
    inject_script: tagMap ? tagMap.tagInject : false,
    injectedScripts: tagMap ? tagMap.tagScripts : [],
    repo: null,
    server: null,

    tag_id: tag.tag_id,
    once_per_event: tag.once_per_event || false,
    once_per_load: tag.once_per_load || false,
    vtp: {}
  };

  // Extract vtp_ properties
  Object.keys(tag).forEach(key => {
    if (key.startsWith('vtp_')) {
      tagConfig.vtp[key] = tag[key];
    }
  });

  // Extract URLs of HTML tags
  if (tagConfig.function == "__html") {
    let htmlCode = tagConfig.vtp.vtp_html;
    if (htmlCode.includes("script")) {
      setHtmlInjectedScripts(htmlCode, tagConfig); // Set injected scripts from HTML code
    } else if (Array.isArray(htmlCode)) {
      htmlCode.filter(code => typeof code === 'string')
        .forEach(code => setHtmlInjectedScripts(code, tagConfig)); // Process each string in the array
    }
  }

  // Update the scriptsMap with injected scripts
  addScript(tagConfig.injectedScripts, tagConfig.tag, scriptsMap);
  return tagConfig;
}

// Function to set the gallery configuration for a tag
export function setGalleryConfig(tagConfig, possibleTags, scriptsMap, runtimes) {
  tagConfig.collision = possibleTags.length; // Update collision count
  tagConfig.tag = possibleTags.map(tag => tag.tagName); // Update tag names
  tagConfig.description = possibleTags.map(tag => tag.tagDesc); // Update descriptions
  tagConfig.tmb = possibleTags.map(tag => (tag.tagTmb ? tag.tagTmb : null)); // Update thumbnails
  tagConfig.inject_script = possibleTags.map(tag => tag.tagInject); // Update injection permissions

  // Update injected scripts and add to scriptsMap
  tagConfig.injectedScripts = possibleTags.map(tag => {
    if (tag.tagInject && tag.tagScripts.length == 0) {
      tag.tagScripts = getRuntimeScripts(tagConfig, runtimes); // Get runtime scripts if none are provided
    }
    addScript(tag.tagScripts, tag.tagName, scriptsMap); // Add scripts to scriptsMap
    return tag.tagScripts;
  });

  tagConfig.repo = possibleTags.map(tag => tag.tagRepo); // Update repository information
  tagConfig.sha = possibleTags.map(tag => tag.tagVersion); // Update version information
}

// Function to set a custom tag configuration
export async function setCustomTag(tagConfig, perms, scriptsMap, runtimes) {
  tagConfig.tag = [];
  tagConfig.description = [];
  tagConfig.collision = -1; // Set collision to -1 for custom tags
  tagConfig.inject_script = (perms.inject_script != undefined); // Set injection permission
  tagConfig.injectedScripts = getScripts(perms); // Get scripts based on permissions
  if (tagConfig.inject_script && tagConfig.injectedScripts.length == 0) {
    tagConfig.injectedScripts = getRuntimeScripts(tagConfig, runtimes); // Get runtime scripts if none are provided
  }
  // Update scriptsMap with the custom tag's scripts
  addScript(tagConfig.injectedScripts, "Custom Tag", scriptsMap);

  tagConfig.perms = perms; // Store permissions
  tagConfig.permsHash = await hashTag(correct(perms)); // Compute hash of permissions
}

// Function to get server tags from the data
export function getServerTags(data) {
  const tag = { "server": null };
  if (data.macros) {
    const found = data.macros.find(f => f["function"] == "__gtcs");
    if (found != undefined) {
      tag.server = found["vtp_configSettingsTable"][1][4]; // Extract server information
      console.log("found server ", tag.server);
    } else {
      console.log("no server tags detected !");
    }
  }
  return tag;
}

// Function to get tags configuration and scripts map
export async function getTagsConfiguration(data, tagsMap, galleryMap) {
  let tagConfigs = [];       // Will contain the enriched configuration of each tag
  let scriptsMap = {};       // Will contain the scripts associated with tags (for optional visualization)

  if (!data) return { tagConfigs, scriptsMap };

  // Step 1: for each raw tag in the container, build an enriched version (tagConfig)
  tagConfigs = await Promise.all(
    data.tags.map(async (tag) => {
      const tagConfig = getTagConfig(tag, tagsMap, scriptsMap); // Decode the base configuration of the tag

      // If the tag is not recognized as "official"
      if (!tagConfig.tag) {
        tagConfig.official = false;

        try {
          // If there is a permission associated with its function
          if (data.permissions[tag.function]) {
            const possibleTags = await getPossibleTags(data.permissions[tag.function], galleryMap);

            if (possibleTags.length > 0) {
              // Case: the tag is in the known gallery (non-official but recognized)
              setGalleryConfig(tagConfig, possibleTags, scriptsMap, data.runtimes);
            } else {
              // Case: the tag is unknown and defined by a user
              await setCustomTag(tagConfig, data.permissions[tag.function], scriptsMap, data.runtimes);
            }
          } else {
            // Edge case: no known permission, mark it as unknown
            await setCustomTag(tagConfig, { type: 'official-unknown', tag }, scriptsMap, data.runtimes);
          }
        } catch (err) {
          console.warn('[getTagsConfiguration] Error while analyzing the tag:', err);
        }
      }

      // Enrichment: check whether the tag sends data to a server
      const info = tagSendsDataToServerSide(data, tag);
      tagConfig.sendsDataToServerSide     = info !== false; // true if a server is detected
      tagConfig.sendsDataToServerSideInfo = info || null;   // contains the server URL if available

      return tagConfig;
    })
  );

  // Step 2: optionally add a synthetic tag dedicated to the server-side container
  const serverTag = getServerTags(data);
  if (serverTag.server) {
    tagConfigs.push({
      ...serverTag,
      sendsDataToServerSide: true,
      sendsDataToServerSideInfo: serverTag.server
    });
  }

  // Return the full tag configuration and associated scripts
  return { tagConfigs, scriptsMap };
}


// Function to get unique tags from the tags configuration
export function getUniqueTags(tagsConfiguration) {
  const uniqueTagsMap = {};

  tagsConfiguration.forEach(tag => {
    let key;

    // Never merge tags that point to a server-side container
    if (tag.sendsDataToServerSide === true) {
      key = `srv-${tag.tag_id}`;          // unique key id 
    } else {
      key = tag.server
        || ((tag.official && tag.vtp.vtp_html !== undefined)
              ? tag.tag_id
              : (!tag.official && tag.collision === -1)
                  ? tag.permsHash
                  : tag.tag);
    }

    uniqueTagsMap[key] = tag;
  });

  return Object.values(uniqueTagsMap);
}

// Function to get blocked tags from a GTM configuration
export function getBlockedTags(gtm) {
  return gtm.tags
    .filter(tag => !tag.isActive) // Filter out inactive tags
    .map(tag => tag.function === "__html" ? tag.tag_id : tag.function); // Return tag ID or function
}

// Function to get custom script with inactive tags filtered out
export function getCustomScript(gtm) {
  const blockedTags = getBlockedTags(gtm); // Get blocked tags
  const customTags = gtm.data.tags.filter(tag => !blockedTags.includes(tag.function) && !blockedTags.includes(tag.tag_id)); // Filter out blocked tags
  const match = gtm.scriptContent.match(/"tags":(\[[\s\S]*?\]),\s*"predicates"/); // Match the tags section in the script
  const scriptContent = gtm.scriptContent.replace(match[1], JSON.stringify(customTags)); // Replace with custom tags

  return "console.trace();\n" + scriptContent;
}

// Function to get GTM IDs that have been executed using window.google_tag_manager
export function getExecutedGtmsIds(google_tag_manager) {
  let ids = [];
  if (google_tag_manager) {
    Object.keys(google_tag_manager).forEach(key => {
      if (key.startsWith('GTM-')) {
        ids.push(key.slice(4)); // Extract GTM ID
      }
    });
  }
  return ids;
}



/*CODE DE GILLES */

/*****
 * Functions to parse "interesting" information from raw data extarcted by dataExtractor 
 */

// Compute a SHA-256 hash of a JSON object
async function hashJson(jsonObj) {
  const json = JSON.stringify(jsonObj); // Convert JSON object to string
  const encoder = new TextEncoder(); // Create a TextEncoder instance
  const data = encoder.encode(json); // Encode the JSON string as bytes
  const hashBuffer = await crypto.subtle.digest('SHA-256', data); // Compute SHA-256 hash
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // Convert hash buffer to byte array
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // Convert byte array to hexadecimal string
  return hashHex;
}

// Function to correct the tag permissions by adding "allowedKeys" if missing
function correctPermissions(permissions) {
  const key = "read_data_layer";
  if (permissions[key] !== undefined && permissions[key]["keyPatterns"] !== undefined && permissions[key]["allowedKeys"] === undefined) {
    permissions[key] = { "allowedKeys": "specific", ...permissions[key] };
  }
  return permissions;
}

// Function to get the hashed permissions of a tag
async function hashPermissions(permissions) {
  return await hashJson(correctPermissions(permissions)); // Compute the hash of the corrected tag data
}

async function parseGalleryTag(tag, data, galleryTagMap) {
  const permissionHash = await hashPermissions(data.permissions[tag.function])
  let possibleTags = galleryTagMap[permissionHash]

  if (possibleTags === undefined) {
    return {
      type: "custom tag",
      potentialRequests: ["not yet implemented"],

      dataCollector: false,
      configuration: ["not yet implemented"],
      permissions: ["not yet implemented"],

      permissionHash: permissionHash
    }

  } else if (possibleTags.length === 1) {
    return {
      ...possibleTags[0],

      //type: gallery from possibleTags[0]
      configuration: ["not yet implemented"],

      commitDate: "not yet implemented",
      permissionHash: permissionHash
    }
  } else { //multiple tags
    return {
      name: "multiple Tags possible", //TODO: find a name common to the tags?
      type: "multiplePossibilities",

      potentialRequests: ["not yet implemented"],

      configuration: ["not yet implemented"],
      permissions: ["not yet implemented"],

      permissionHash: permissionHash,

      possibleTags: possibleTags
    }
  }
}

export let tagParserStatistics = {
  macroFunctions: {}
}

function decodeMacroWithContext(macro, macros, host) {
  if (host === undefined) host = "{WEBSITE DOMAIN}";

  function decode(m) {
    if (typeof m === "string") {
      if (m.startsWith("//"))        return m.slice(2);
      if (m.startsWith("http://"))   return m.slice(7);
      if (m.startsWith("https://"))  return m.slice(8);
      return m;
    }
    if (Array.isArray(m) && m[0] === "macro")    return decode(macros[m[1]]);
    if (Array.isArray(m) && m[0] === "template") return m.slice(1).map(decode).join("");
    if (m.function === "__c")   return decode(m.vtp_value);
    if (m.function === "__u" && m.vtp_component === "HOST") return host;
    if (m.function?.startsWith("__cvt_")) return "{COMPLEX VARIABLE}";
    return null;
  }

// 1) direct attempt: immediately return the detected URL
  const direct = decode(macro);
  if (typeof direct === "string" && direct) return direct;

// 2) otherwise explore potential vtp_map entries to collect URLs
  const urls = new Set();
  if (Array.isArray(macro.vtp_map)) {
    for (let i = 1; i < macro.vtp_map.length; i++) {
      const el = macro.vtp_map[i];
      if (el && el[4] !== undefined) {
        const u = decode(el[4]);
        if (u) urls.add(u);
      }
    }
  }

  return urls.size ? [...urls][0] : null;// null if no URL was found
}


export function tagSendsDataToServerSide(data, t, host) { //check for tags sendig data to server side gtm, returns undefind if no sending, the domain of the server if sending
  if (t.function === "__googtag") {

    function getServerGTMUrl(gtagSettings) {
      if (gtagSettings !== undefined) {
        for (let i = 0; i < gtagSettings.length; i++) {
          const element = gtagSettings[i];
          if (element[2] === "server_container_url") {
            return decodeMacroWithContext(element[4], data.macros, host)
          }
        }
      }
    }

    if (t.vtp_configSettingsTable !== undefined) {
      return getServerGTMUrl(t.vtp_configSettingsTable)
    } else if (t.vtp_eventSettingsTable !== undefined) {
      return getServerGTMUrl(t.vtp_eventSettingsTable)
    } else if (t.vtp_configSettingsVariable !== undefined) {
      let macroId = t.vtp_configSettingsVariable[1]
      return getServerGTMUrl(data.macros[macroId].vtp_configSettingsTable)
    } else if (t.vtp_eventSettingsVariable !== undefined) {
      let macroId = t.vtp_eventSettingsVariable[1]
      return getServerGTMUrl(data.macros[macroId].vtp_eventSettingsTable)
    } else {
      // console.log("no configuration")
    }
  }
  return false
}

// Get the tag information from the "raw" data from the data extractor 
export async function parseTags(data, officialTagMap, galleryTagMap) {
  const tags = [];

  for (const t of data.tags) {
    const base = { tagIdGtm: t.tag_id };
    const info = tagSendsDataToServerSide(data, t);
    const sendsDataToServerSide = info !== false;

    if (t.function === "__html") {
      tags.push({
        ...base,
        type: "html",
        allowedRequests: ["not yet implemented"],
        htmlCode: t.vtp_html,
        sendsDataToServerSide,
        sendsDataToServerSideInfo: info || null
      });
      continue;
    }

    if (t.function === "__img") {
      tags.push({
        ...base,
        type: "image",
        allowedRequests: ["not yet implemented"],
        imageUrl: t.vtp_url,
        sendsDataToServerSide,
        sendsDataToServerSideInfo: info || null
      });
      continue;
    }

    if (String(t.function).startsWith("__cvt_")) {
      const galleryTag = await parseGalleryTag(t, data, galleryTagMap);
      tags.push({
        ...base,
        ...galleryTag,
        sendsDataToServerSide,
        sendsDataToServerSideInfo: info || null
      });
      continue;
    }

    const officialTag = officialTagMap[t.function];
    if (!officialTag) {
      tags.push({
        ...base,
        type: "official",
        name: "unknow tag",
        brand: "unknown",
        description: "This official tag was not recognized",
        thumbnail: undefined,
        permissions: ["not yet implemented"],
        potentialRequests: ["not yet implemented"],
        sendsDataToServerSide,
        sendsDataToServerSideInfo: info || null
      });
    } else {
      tags.push({
        ...base,
        type: "official",
        ...officialTag,
        sendsDataToServerSide,
        sendsDataToServerSideInfo: info || null
      });
    }
  }

  return tags;
}


