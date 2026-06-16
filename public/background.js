'use strict';
console.log('[BG] Service worker started.');

// Imports – GTM helper libraries
import {
  getCustomScript,
  getTagsConfiguration,
  getUniqueTags,
  tagSendsDataToServerSide
} from './gtm-lib/gtmDataParser.js';

import {
  initTree,
  addRequest,
  getPossibleInjectors,
  getGtmUrlFromInitiator
} from './gtm-lib/gtmInjectionTree.js';

import {
  extractInitiator,
  isGtmScript
} from './gtm-lib/gtmHelper.js';

// Injection‑session state
let nodeMap        = {};    // current injection tree
let stillReceiving = true;  // true while Network events keep arriving
let currentGtm     = null;  // GTM container currently injected

// Page context
let currentPageUrl = null;  // real page URL (not the popup)
let lastRealTabId  = null;  // last active, non‑popup tab
let targetTabId    = null;  // tab where the content script runs

// Processing guards
let isProcessing = false;   // mutex for dynamic‑rule edits
let capturedUrls = {};      // URL → initiator for obfuscated GTM level 3

// CSV whitelist cache (sitesConfig.csv)
let siteConfigMap = null;   // host → whitelist tokens

// Load and cache sitesConfig.csv (returns a Map: host → [tokens])
const loadSitesCsv = async () => {
  if (siteConfigMap) return siteConfigMap;           // already cached

  const resp = await fetch(chrome.runtime.getURL('./assets/sitesConfig.csv'));
  const text = await resp.text();
  siteConfigMap = new Map();

  text.split(/\r?\n/).forEach(line => {
    if (!line.trim()) return;                        // skip empty lines
    const parts = line.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const host = parts[0]
        .replace(/^https?:\/\//i, '')                // drop protocol
        .replace(/^www\./i, '')                      // drop www
        .replace(/\/.*$/, '');                       // drop path
      siteConfigMap.set(host, parts.slice(1));       // remaining parts are tokens
    }
  });

  return siteConfigMap;
};

// Check if a given site (from its URL) is listed in the CSV
const isSiteListed = async url => {
    const host = (new URL(url)).hostname.replace(/^www\./i, '');
    const map = await loadSitesCsv();
    return map.has(host);
};

// Get the list of allowed tags for a given site (from its URL)
const getTagsForSite = async url => {
    const host = (new URL(url)).hostname.replace(/^www\./i, '');
    const map = await loadSitesCsv();
    return map.get(host) || [];
};

// Check the site whitelist and update chrome.storage.local accordingly
const checkSiteWhitelist = async url => {
    if (!url || !url.startsWith('http')) return;

    const host = (new URL(url)).hostname.replace(/^www\./i, '');
    if (!(await isSiteListed(url))) {
        console.log(`[BG] ${host} NOT listed in the CSV.`);
        return;
    }

    const tags = await getTagsForSite(url);

    console.log(`[BG] ${host} listed – ${tags.length} tag(s).`);
    console.log(`[BG] Tags for ${host} :`, tags.join(', ') || 'none');

    chrome.storage.local.get('siteTagWhitelist', data => {
        const wl = data.siteTagWhitelist || {};
        wl[host] = tags;
        chrome.storage.local.set({ siteTagWhitelist: wl });
    });
};

// Store the last real tab ID, ignoring extension popups
chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId, (tab) => {
        if (tab.url && !tab.url.includes('index.html?standalone')) {
            lastRealTabId = tabId;
        }
    });
});

// Print current dynamic rules to the console for debugging
const getRules = () => {
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
        if (chrome.runtime.lastError) {
            console.log("Error retrieving dynamic rules:", chrome.runtime.lastError);
        } else {
            console.log("Active dynamic rules:", rules);
            rules.forEach((rule) => {
                console.log(`Rule ID: ${rule.id}`);
                console.log(`Priority: ${rule.priority}`);
                console.log(`Action: ${JSON.stringify(rule.action)}`);
                console.log(`Condition: ${JSON.stringify(rule.condition)}`);
            });
        }
    });
};

// Get the content-script tab ID or fall back to current active tab
const getContentTabId = (cb) => {
    if (targetTabId !== null) return cb(targetTabId);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) cb(tabs[0].id);
    });
};

// Delete all active dynamic rules (useful for reset)
const deleteAllDynamicRules = () => {
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
        if (chrome.runtime.lastError) {
            console.log("Error retrieving dynamic rules:", chrome.runtime.lastError);
            return;
        }
        const ruleIds = rules.map(rule => rule.id);
        chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [],
            removeRuleIds: ruleIds
        }, () => {
            if (chrome.runtime.lastError) {
                console.log("Error deleting dynamic rules:", chrome.runtime.lastError);
            } else {
                console.log("All dynamic rules deleted successfully.");
            }
        });
    });
};

// Wrapper to get dynamic rules using promises
const getDynamicRules = () => {
    return new Promise((resolve, reject) => {
        chrome.declarativeNetRequest.getDynamicRules((rules) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(rules);
            }
        });
    });
};

// Wrapper to update dynamic rules using promises
const updateDynamicRules = (dynamicRule) => {
    return new Promise((resolve, reject) => {
        chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [dynamicRule],
            removeRuleIds: []
        }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
};

// Add a rule to block a script URL
const block = async (blockedUrl) => {
    try {
        const rules = await getDynamicRules();
        const newId = rules.reduce((max, rule) => (rule.id > max) ? rule.id : max, 2) + 1;
        const dynamicRule = {
            id: newId,
            priority: 2,
            action: { type: 'block' },
            condition: { urlFilter: blockedUrl, resourceTypes: ['script'] }
        };
        await updateDynamicRules(dynamicRule);
        console.log("Dynamic rule added to block:", blockedUrl);
    } catch (error) {
        console.log("Error:", error);
    }
};

// Add a rule to redirect a script to a custom URL
const redirect = async (blockedUrl, redirectTo) => {
    try {
        const rules = await getDynamicRules();
        const newId = rules.reduce((max, rule) => (rule.id > max) ? rule.id : max, 2) + 1;
        const dynamicRule = {
            id: newId,
            priority: 2,
            action: {
                type: 'redirect',
                redirect: { url: redirectTo }
            },
            condition: { urlFilter: blockedUrl, resourceTypes: ['script'] }
        };
        await updateDynamicRules(dynamicRule);
        chrome.storage.local.set({ [redirectTo]: blockedUrl });
        console.log("Dynamic rule added to redirect:", blockedUrl, "to:", redirectTo);
    } catch (error) {
        console.log("Error:", error);
    }
};

// Attach Chrome debugger to a tab and enable Network + Runtime debugging
const attachDebugger = (tabId) => {
    chrome.debugger.attach({ tabId: tabId }, '1.2', function () {
        if (chrome.runtime.lastError) {
            console.log(chrome.runtime.lastError);
            return;
        }

        chrome.debugger.sendCommand({ tabId: tabId }, 'Network.enable', {}, function () {
            if (chrome.runtime.lastError) {
                console.log(chrome.runtime.lastError);
            } else {
                console.log("Network enabled!");
            }
        });

        chrome.debugger.sendCommand({ tabId: tabId }, 'Runtime.enable', {}, function () {
            if (chrome.runtime.lastError) {
                console.log(chrome.runtime.lastError);
            } else {
                console.log("Runtime enabled!");
            }
        });

        chrome.debugger.sendCommand({ tabId: tabId }, 'Runtime.setAsyncCallStackDepth', { maxDepth: 32 }, function () {
            if (chrome.runtime.lastError) {
                console.log(chrome.runtime.lastError);
            } else {
                console.log("Async call stack depth set!");
            }
        });
    });
};

// Detach the debugger from a tab and reset tracking state
const detachDebugger = (tabId) => {
    chrome.debugger.detach({ tabId: tabId }, function () {
        if (chrome.runtime.lastError) {
            console.log(chrome.runtime.lastError);
        } else {
            console.log("Debugger detached from tab:", tabId);
            currentGtm = null;
            capturedUrls = {};
        }
    });
};


// Injects a GTM container that has already been analyzed
const authorizeGtm = async (gtm) => {
    const tabId = targetTabId || lastRealTabId;
    if (!tabId) {
        console.warn('[BG] authorizeGtm : aucun tabId valide !');
        return;
    }

    // Prepare tree and attach debugger
    stillReceiving = true;
    currentGtm = gtm;
    nodeMap = {};
    const root = initTree(gtm.url, nodeMap);
    attachDebugger(tabId);

    // Periodically update the UI with the tag tree every second
    const intervalId = setInterval(() => {
        gtm.tree = root.children;
        chrome.runtime.sendMessage({ type: 'injectionTree', gtm });

        if (!stillReceiving) {
            detachDebugger(tabId);
            clearInterval(intervalId);
            chrome.tabs.sendMessage(tabId, { type: 'updateGtm', updatedGtm: gtm });
            console.log('[BG] Injection terminée, debugger détaché');
        } else {
            stillReceiving = false;
        }
    }, 1000);

    // Inject custom GTM script into the tab
    const scriptContent = getCustomScript(gtm);
    chrome.scripting.executeScript(
        {
            target: { tabId },
            func: injectJs,
            world: 'MAIN',
            args: [scriptContent],
        },
        () => {
            if (chrome.runtime.lastError) {
                console.error('Erreur injection GTM :', chrome.runtime.lastError);
            } else {
                console.log('GTM autorisé et injecté dans l’onglet', tabId);
                sendMessageToTab(tabId, { type: 'updateBlocked', gtm });
            }
        }
    );
};

// Sends a message to a tab, with retries if initial attempt fails
const sendMessageToTab = (tabId, message, retries = 2, delay = 1000) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
            if (retries > 0) {
                console.log(`Retrying... attempts left: ${retries}`);
                setTimeout(() => {
                    sendMessageToTab(tabId, message, retries - 1, delay);
                }, delay);
            }
        } else {
            console.log('Message sent successfully: ', response);
        }
    });
}

// Extract GTM object from window (for content script evaluation)
const getWindowGtm = () => window.google_tag_manager

// Injects JavaScript code in the page context without inline script
const injectJs = (code) => {
    try {
        (0, eval)(code);
        console.log('[BG] GTM exécuté via eval()');
    } catch (e) {
        console.error('[BG] Échec injection GTM :', e);
    }
};

// Reloads the given tab
const refreshPage = (tabId) => {
    chrome.tabs.reload(tabId, {}, () => {
        if (chrome.runtime.lastError) {
            console.log("Failed to reload tab:", chrome.runtime.lastError);
        } else {
            console.log("Tab reloaded successfully.");
        }
    });
}

// Fetches the official GTM tags map from a local JSON file
const getOfficialTagsMap = async () => {
    const response = await fetch(chrome.runtime.getURL('./assets/officialTagsMap.json'))
    return response.json()
}

// Fetches the gallery tags map from a local JSON file
const getGalleryMap = async () => {
    const response = await fetch(chrome.runtime.getURL('./assets/galleryMap.json'))
    return response.json()
}

// Retrieves the full tag configuration for a GTM container
const getTagsConfig = async (data) => {
    const tagsMap = await getOfficialTagsMap()
    const galleryMap = await getGalleryMap()
    const tagConfigurations = await getTagsConfiguration(data, tagsMap, galleryMap);
    return tagConfigurations
}



// ---------------------------------------------------------------------------
// Update of setTags – ensures every “image-type” tag exposes a usable `url`
//   • covers native __img tags, gallery/official templates that send pixels,
//     and any tag whose transport is set to “image”.
//   • adds detailed debug logs when an URL is fixed or still missing.
// ---------------------------------------------------------------------------

const setTags = async gtm => {
  // 1 – parse the container → get enriched tag configs + scripts map
  const { tagConfigs, scriptsMap } = await getTagsConfig(gtm.data);
  let uniqueTags = getUniqueTags(tagConfigs);                 // deduplicated list

  // 2 – read whitelist for the current host (if any)
  let allowedTokens = [];
  let allowAll      = false;
  try {
    if (currentPageUrl) {
      const host  = new URL(currentPageUrl).hostname.replace(/^www\./i, '');
      const store = await new Promise(res =>
        chrome.storage.local.get('siteTagWhitelist', d => res(d.siteTagWhitelist || {}))
      );
      allowedTokens = (store[host] || []).map(t => String(t).trim());
      allowAll      = allowedTokens.some(t => t.toLowerCase() === 'all');
      console.log('[BG] Whitelist for %s → %o', host, allowedTokens);
    }
  } catch (e) {
    console.warn('[BG] setTags – unable to read whitelist:', e);
  }

  // 3 – early exit if “all” token is present
  if (allowAll) {
    gtm.tags       = uniqueTags.map(t => ({ ...t, isActive: true }));
    gtm.isBlocked  = false;
    gtm.scriptsMap = scriptsMap;
    console.log('[BG] token “all” detected – every tag activated');
    return;
  }

  /* ----------------------------------------------------------------------
   * 4 – IMAGE-TAG URL PATCH
   * --------------------------------------------------------------------
   * The UI (ImageTagModal) expects a `tag.url` or `tag.vtp.vtp_image_url`.
   * Some templates – e.g. GA hits with `vtp_transport:"image"` – do not
   * expose it, which leads to “URL introuvable”.  
   * Below we try several fallbacks; when everything fails we still provide
   * a placeholder to avoid the UI error.
   * -------------------------------------------------------------------- */
  uniqueTags = uniqueTags.map(t => {
    const vtp = t.vtp || {};
    if (!t.url || t.url === '') {
      // common GTM keys
      const fallback =
        vtp.vtp_url            ||     // native __img template
        vtp.vtp_image_url      ||     // some gallery templates
        vtp.vtp_pixel_url      ||     // custom templates
        null;

      if (fallback) {
        t.url = fallback;
        console.log('[BG] [img-URL] set from VTP for tag id %s ➜ %s', t.tag_id, t.url);
      } else if (vtp.vtp_transport === 'image' || vtp.vtp_useImageTag === true) {
        // final fallback – at least warn the UI it is a runtime URL
        t.url = '(dynamic-image-request)';
        console.log('[BG] [img-URL] dynamic pixel (no static URL) for tag id %s', t.tag_id);
      }
    }
    return t;
  });

  // 5 – add missing server-side tags (unchanged)
  const rawTags = gtm.data.tags || [];
  const missingServerTags = rawTags
    .map(t => {
      const info = tagSendsDataToServerSide(gtm.data, t);
      return info !== false ? { ...t, sendsDataToServerSide: true, sendsDataToServerSideInfo: info } : null;
    })
    .filter(Boolean)
    .filter(t => !uniqueTags.find(x => x.tag_id === t.tag_id));
  uniqueTags = [...uniqueTags, ...missingServerTags];

  // 6 – decide which tags stay active w.r.t. whitelist
  const norm        = s => String(s).trim().toLowerCase();
  const allowedSet  = new Set(allowedTokens.map(norm));
  gtm.tags = uniqueTags.map(tag => {
    const idTok   = String(tag.tag_id);
    const nameTok = tag.official
      ? (tag.tag ? [tag.tag] : [])
      : Array.isArray(tag.tag) ? [...tag.tag] : ['custom tag'];
    const isActive = [idTok, ...nameTok].some(tok => allowedSet.has(norm(tok)));
    return { ...tag, isActive };
  });

  gtm.isBlocked  = !gtm.tags.some(t => t.isActive);
  gtm.scriptsMap = scriptsMap;

  // 7 – final debug dump
  console.log('[BG] Tag list for GTM %s', gtm.id || gtm.url);
  gtm.tags.forEach(t =>
    console.log(' — [%s] %s → %s', t.tag_id, t.tag || t.function, t.isActive ? 'active' : 'inactive')
  );
};







// track every script request to build the injection tree or catch obfuscated GTM
chrome.debugger.onEvent.addListener(function (source, method, params) {
    if (method === 'Network.requestWillBeSent' && params.type === 'Script') {
        if (params.initiator.type === 'script' && params.request.url.startsWith('http')) {
            const initator = extractInitiator(params.initiator.stack);
            if (currentGtm) {
                // we already have a GTM, so we update the tree
                stillReceiving = true;
                const req = { url: params.request.url, initiator: initator || currentGtm.url };
                addRequest(req, getPossibleInjectors(req.url, currentGtm.scriptsMap), nodeMap);
            } else {
                // no GTM yet -> maybe obfuscated, keep the url for later
                capturedUrls[params.request.url] = initator;
            }
        }
    }
});


// fired every time a dynamic rule matches; we inspect if it is a GTM
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (e) => {
    const blockedUrl = e.request.url;
    const ruleId = e.rule.ruleId;
    const gtmProps = await isGtmScript(blockedUrl, e.request.initiator);
    if (!gtmProps) return;

    if (ruleId === 2) {
        // rule 2 -> we block, so wait if we are already processing
        while (isProcessing) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        isProcessing = true;
        await block(blockedUrl);
        isProcessing = false;
        refreshPage(e.request.tabId);
    } else {
        // rule != 2 -> we might allow depending on whitelist
        chrome.storage.local.get([blockedUrl], async (result) => {
            gtmProps.url = result[blockedUrl] || blockedUrl;
            await setTags(gtmProps);
            sendMessageToTab(e.request.tabId, { type: 'updateBlocked', gtm: gtmProps });

            if (!gtmProps.isBlocked) {
                console.log('[BG] Container auto‑allowed (whitelist):', gtmProps.url);
                authorizeGtm(gtmProps);
            }
        });
    }
});


// central message router used by popup and content‑scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'setTargetTab') {
        targetTabId = lastRealTabId;  // remember where the popup was opened
        return;                       // nothing else

    } else if (message.type === 'getGtms') {
        // popup asks the list of GTMs
        getContentTabId((tabId) => {
            if (!tabId) {
                sendResponse([]); // no content‑script yet
                return;
            }
            chrome.tabs.sendMessage(tabId, { type: 'getGtms' }, (resp) => {
                sendResponse(resp || []);
            });
        });
        return true; // async response

    } else if (message.type === 'currentPageInfo') {
        // content‑script tells us the real page URL
        currentPageUrl = message.url;

        if (sender.tab && sender.tab.id) {
            targetTabId = sender.tab.id;
        }
        checkSiteWhitelist(currentPageUrl);
        // forward to the popup if it is open
        chrome.runtime.sendMessage({ type: 'pageUrl', url: currentPageUrl });
        return;

    } else if (message.type === 'getPageInfo') {
        // popup asks the current URL
        sendResponse({ url: currentPageUrl });
        return true; // async

    } else if (message.type === 'allowGTM') {
        // user explicitly allowed the container from UI
        authorizeGtm(message.gtm);

    } else if (message.type === 'updateGtm') {
        // UI changed a GTM (toggle a tag etc.)
        const gtm = message.updatedGtm;

        const sendAndInject = (tabId) => {
            // 1. tell content‑script to refresh UI
            chrome.tabs.sendMessage(tabId, message);

            // 2. if now allowed, inject into page
            if (!gtm.isBlocked) {
                const scriptContent = getCustomScript(gtm);
                chrome.scripting.executeScript(
                    {
                        target: { tabId },
                        func: injectJs,
                        world: 'MAIN',
                        args: [scriptContent, gtm.url],
                    },
                    () => {
                        if (chrome.runtime.lastError) {
                            console.warn('GTM injection failed:', chrome.runtime.lastError);
                        } else {
                            console.log('GTM re‑injected in tab', tabId);
                        }
                    }
                );
            }
        };

        if (targetTabId !== null) {
            sendAndInject(targetTabId);
        } else {
            getContentTabId((tid) => tid && sendAndInject(tid));
        }
        return;

    } else if (message.type === 'newGtm') {
        // forward newGtm to popup (it re‑uses same channel)
        chrome.runtime.sendMessage(message);
        return;

    } else if (message.type === 'getWindowGtm') {
        // popup wants window.google_tag_manager from the page
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && tab.url && tab.url.startsWith('http')) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: getWindowGtm,
                    world: 'MAIN',
                }, (results) => {
                    if (chrome.runtime.lastError) {
                        console.log('Error getting window GTM:', chrome.runtime.lastError);
                    } else {
                        chrome.tabs.sendMessage(tab.id, { type: 'windowGtm', google_tag_manager: results[0].result });
                    }
                });
            }
        });

    } else if (message.type === 'addGtm') {
        // level‑3 obfuscated GTM detected by content‑script
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const tabId = tabs[0].id;
            attachDebugger(tabId);
            const googleUrl = message.googleUrl;
            const gtmProps = await isGtmScript(googleUrl, message.initiator);
            await setTags(gtmProps);
            const initiator = getGtmUrlFromInitiator(capturedUrls, gtmProps.scriptsMap);
            if (initiator) {
                detachDebugger(tabId);
                await redirect(initiator, googleUrl);
                refreshPage(tabId);
            } else {
                gtmProps.isBlocked = false;
                gtmProps.obfuscation = true;
                // update content‑script UI
                chrome.tabs.sendMessage(tabId, { type: 'updateBlocked', gtm: gtmProps });
            }
        });

    } else if (message.type === 'getRealTabInfo') {
        // popup wants the exact URL of the real tab (not the extension popup)
        const tabId = targetTabId || lastRealTabId;
        if (tabId) {
            chrome.tabs.get(tabId, (tab) => {
                if (chrome.runtime.lastError || !tab) {
                    sendResponse(null);
                } else {
                    sendResponse({ url: tab.url });
                }
            });
            return true; // async response
        } else {
            sendResponse(null);
        }
    }
});
