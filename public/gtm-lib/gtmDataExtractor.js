
export const GOOGLE_TAG_MANAGER_URL = "https://www.googletagmanager.com/gtm.js?id=GTM-";
export const PROXY_URL = 'http://localhost:3000/proxy';

// Function to extract the GTM ID from the script content
/** Renvoie seulement « ABC123 » à partir d’une URL quelconque. */
export function extractGtmId(url) {
  if (typeof url !== 'string') return null;

  // …gtm.js?id=GTM-ABC123
  let m = url.match(/[?&#]id=GTM-([A-Z0-9]+)/i);
  if (m) return m[1];          // ← m[1] = ABC123

  // fallback : …/GTM-ABC123 ou …&gtm=GTM-ABC123
  m = url.match(/GTM-([A-Z0-9]+)/i);
  return m ? m[1] : null;      // ← retourne seulement ABC123
}


// Function to extract macros from the script content
export function extractMacros(scriptContent) {
    const match = scriptContent.match(/"macros":(\[[\s\S]*?\])\s*,\s*"tags"/);
    if (match && match[1]) {
        try {
            return JSON.parse(match[1]);
        } catch (error) {
            console.log('Error parsing Macros:', error);
        }
    }
    return null;
}

// Function to extract tags from the script content
export function extractTags(scriptContent) {
    const match = scriptContent.match(/"tags":(\[[\s\S]*?\])\s*,\s*"predicates"/);
    if (match && match[1]) {
        try {
            return JSON.parse(match[1]);
        } catch (error) {
            console.log('Error parsing Tags:', error);
        }
    }
    return null;
}

// Function to extract runtime data from the script content
export function extractRuntimes(scriptContent) {
    const match = scriptContent.match(/"runtime":(\[[\s\S]*?\])\s*,\s*"entities"/);
    if (match && match[1]) {
        try {
            return JSON.parse(match[1]);
        } catch (error) {
            console.log('Error parsing Runtime:', error);
        }
    }
    return null;
}

// Function to extract permissions from the script content
export function extractPermissions(scriptContent) {
    const match = scriptContent.match(/"permissions":(\{[\s\S]*?\})\s*,\s*("security_groups"|"sandboxed_scripts")/);
    if (match && match[1]) {
        try {
            return JSON.parse(match[1]);
        } catch (error) {
            console.log('Error parsing Permissions:', error);
        }
    }
    return null;
}

// Function to extract data from the GTM script
export function extractRawInformation(scriptContent) {
    let data = null;
    if (scriptContent) {
        data = {
            tags: extractTags(scriptContent),
            permissions: extractPermissions(scriptContent),
            runtimes: extractRuntimes(scriptContent),
            macros: extractMacros(scriptContent),
            gtmId: extractGtmId(scriptContent)
        };
    }
    return data;
}
