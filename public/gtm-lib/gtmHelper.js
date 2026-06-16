// gtmHelper.js

import { extractRawInformation, extractGtmId } from './gtmDataExtractor.js';
import { parseTags } from './gtmDataParser.js';

// Constants
export const GOOGLE_TAG_MANAGER_URL = 'https://www.googletagmanager.com/gtm.js?id=GTM-';
export const PROXY_URL = 'http://localhost:3000/proxy';

// This regex is used to extract GTM ID from script URL
export const GTM_REGEX = /https:\/\/([^\/]+)\/([^\/]+)\?[^=]*=GTM-([A-Za-z0-9]+)/;

/**
 * Recursively extracts the original initiator URL from a stack trace.
 * Very useful when debugging which script caused the GTM injection.
 */
export function extractInitiator(stack) {
  const callFrames = stack.callFrames;
  const parent = stack.parent;
  const urlFound = callFrames.find(frame => frame.url);
  return urlFound?.url || (parent ? extractInitiator(parent) : null);
}

/**
 * Given a partial GTM script URL, return the canonical GTM source URL.
 */
export function getGtmUrl(scriptUrl) {
  const match = scriptUrl.match(GTM_REGEX);
  if (match) {
    const gtmId = match[3];
    return GOOGLE_TAG_MANAGER_URL + gtmId;
  }
  return null;
}

/**
 * If direct fetch fails due to CORS, try to use a local proxy.
 * This allows us to bypass CORS restrictions in development.
 */
export async function fetchScriptContentProxy(targetUrl, referer) {
  try {
    const res = await fetch(PROXY_URL + '/' + encodeURIComponent(targetUrl) + '/' + encodeURIComponent(referer));
    const jsonData = await res.json();
    if (jsonData.status) return jsonData.data;
    console.warn(jsonData.message);
  } catch (e) {
    console.warn("Proxy fetch failed", e);
  }
  return null;
}

/**
 * Try to fetch script content directly.
 * If it fails (CORS or network), fallback to proxy.
 */
export async function fetchScriptContent(url, referer = null) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    return response.ok ? await response.text() : await fetchScriptContentProxy(url, referer);
  } catch (error) {
    console.log("Failed fetching url", url);
    return null;
  }
}

/**
 * Main function to analyze a script and check if it's a valid GTM.
 * If yes, it returns a full GTM object with parsed tags and metadata.
 */
export async function isGtmScript(scriptUrl, referer = null) {
  let idParam = null;

  // Parse the GTM id from the script URL
  try {
    const u = new URL(scriptUrl);
    idParam = u.searchParams.get('id');
  } catch {
    return null; // Invalid URL
  }

  // Only continue if the id is a valid GTM id
  if (!idParam || !/^GTM-[A-Z0-9\-]{4,}$/i.test(idParam)) return null;

  // Get the full GTM script content
  const scriptContent = await fetchScriptContent(
    getGtmUrl(scriptUrl) || scriptUrl,
    referer
  );
  if (!scriptContent) return null;

  // Extract GTM ID from URL
  const idGtmScript = extractGtmId(scriptUrl);

  // Parse raw data blocks (tags, permissions, etc.)
  const rawData = extractRawInformation(scriptContent);

  // If essential blocks are missing, skip it
  if (!rawData || !rawData.tags || !rawData.permissions) return null;

  // Add a fallback GTM ID if missing
  if (!rawData.gtmId) rawData.gtmId = '(id not found)';

  // Load external maps to enrich the tag metadata
  const [officialTagMap, galleryTagMap] = await Promise.all([
    fetch(chrome.runtime.getURL('./assets/officialTagsMap.json')).then(r => r.json()),
    fetch(chrome.runtime.getURL('./assets/galleryMap.json')).then(r => r.json())
  ]);

  // Parse and enrich the tags using the external maps
  const parsedTags = await parseTags(rawData, officialTagMap, galleryTagMap);

  // Build and return the final GTM object
  return {
    url: scriptUrl,
    scriptContent,
    data: rawData,
    id: idGtmScript,
    isBlocked: true, // default to blocked before user action
    obfuscation: false,
    blockedTags: [],
    tags: parsedTags,
    tree: {
      url: scriptUrl,
      tags: ['GTM'],
      Children: [] // will be filled later if needed
    }
  };
}
