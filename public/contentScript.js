(async () => {
    // Import library
    const gtmParser = await import(chrome.runtime.getURL("./gtm-lib/gtmDataParser.js"));
    const gtmExtractor = await import(chrome.runtime.getURL("./gtm-lib/gtmHelper.js"));
    // Global variable to save GTMs executed
    let undectedGtms = [];
    // Global variable to save GTMs detected
    let gtmsList = [];
    // Mutex
    let isProcessing = false;
    // Notifications
    const NOTIFICATION_CONTAINER_ID = 'gtm-notifications-container';
    const NOTIFICATION_ID = `gtm-state-notification-`;

chrome.runtime.sendMessage({
  type: 'currentPageInfo',
  url: window.location.href
});

    

    const createNotificationContainer = () => {
        return new Promise((resolve) => {
            const container = document.createElement('div');
            container.id = NOTIFICATION_CONTAINER_ID;
            applyStyles(container, {
                position: 'fixed',
                bottom: '10px',
                right: '10px',
                zIndex: '2147483647',
                pointerEvents: 'none',
            });

            // Append the container to the document body
            const intervalId = setInterval(() => {
                if (document.body) {
                    document.body.appendChild(container);
                    clearInterval(intervalId);
                    resolve(container);
                }
            }, 500);
        });
    };

    const createNotificationElement = async (gtm) => {
        const notification_id = `${NOTIFICATION_ID}${gtm.url}`;
        // Create the notification div
        const notification = document.createElement('div');
        notification.id = notification_id;
        applyStyles(notification, {
            padding: '15px 25px',
            color: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            transition: 'opacity 0.3s',
            marginBottom: '2px',
            backgroundColor: gtm.isBlocked ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 128, 0, 0.7)'
        });

        // Display the GTM URL
        const urlText = document.createElement('span');
        urlText.innerText = gtm.url;
        applyStyles(urlText, {
            display: 'flex',
            alignItems: 'center',
            marginBottom: '5px',
        });

        // Add danger indicator if level 3 obfuscation is present
        if (gtm.obfuscation) {
            const dangerIndicator = document.createElement('span');
            dangerIndicator.innerText = '⚠️';
            applyStyles(dangerIndicator, {
                marginLeft: '10px',
                color: 'red',
                fontSize: '16px'
            });
            urlText.appendChild(dangerIndicator);
        }

        // Append URL text to the notification
        notification.appendChild(urlText);

        // Append the notification to the notification container
        let existingContainer = document.getElementById(NOTIFICATION_CONTAINER_ID);
        if (!existingContainer) {
            existingContainer = await createNotificationContainer();
        }
        existingContainer.appendChild(notification);
    };

    // Update the notification Container
    const updateNotification = (gtm) => {
        const notification_id = `${NOTIFICATION_ID}${gtm.url}`;
        const notification = document.getElementById(notification_id);
        if (notification) {
            applyStyles(notification, {
                backgroundColor: 'rgba(0, 128, 0, 0.7)'
            });
        }
    };

    function applyStyles(element, styles) {
        for (const property in styles) {
            if (styles.hasOwnProperty(property)) {
                element.style[property] = styles[property];
            }
        }
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "getGtms") {
            // Sending gtms To the frontEnd
            sendResponse(gtmsList);
            return true;
        } else if (message.type == "updateGtm") {
            // Get gtms updates
            const updatedGtm = message.updatedGtm;
            gtmsList[updatedGtm.index] = updatedGtm;
            if (!updatedGtm.isBlocked) {
                updateNotification(updatedGtm);
            }
        } else if (message.type == "windowGtm") {
            // Search for executed gtms that weren't detected
            const executedIds = gtmParser.getExecutedGtmsIds(message.google_tag_manager);
            executedIds.forEach(id => {
                setTimeout(() => {
                    if (!undectedGtms.includes(id) && !gtmsList.map(gtm => gtm.id).includes(id)) {
                        undectedGtms.push(id);
                        // Sending to background.js
                        chrome.runtime.sendMessage({
                            type: "addGtm",
                            googleUrl: `${gtmExtractor.GOOGLE_TAG_MANAGER_URL}${id}`,
                            initiator: window.location.href,
                        });
                    }
                }, 1000);
            });
        }
    });
    

    chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
        if (message.type === "updateBlocked") {
            // Wait if another process is ongoing
            while (isProcessing) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            isProcessing = true;
            const gtm = message.gtm;
            if (gtmsList.find(gtmElement => gtmElement.url == gtm.url) == undefined) {
                gtm.index = gtmsList.length;
                gtmsList.push(gtm);
                await createNotificationElement(gtm);
                // Update frontEnd
                chrome.runtime.sendMessage({ type: "newGtm", gtm: gtm });
            }
            isProcessing = false;
        }
    });
    

    // Search for executed gtms that weren't detected
    setInterval(() => { chrome.runtime.sendMessage({ type: "getWindowGtm" }) }, 1000);
})();
