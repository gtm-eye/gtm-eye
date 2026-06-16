/* global chrome */
import React from 'react';
import '../styles/OpenWindowButton.css'; 

const OpenWindowButton = () => {
  const isStandalone = new URLSearchParams(window.location.search).has('standalone');

  const handleClick = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab) {
        chrome.runtime.sendMessage({ type: 'setTargetTab', tabId: activeTab.id });
      }

      chrome.windows.create(
        {
          url: chrome.runtime.getURL('index.html?standalone'),
          type: 'popup',
          width: 1000,
          height: 800,
        },
        () => window.close()
      );
    });
  };

  if (isStandalone) return null;

  return (
    <button className="floating-window-button" onClick={handleClick}>
      <img src="/images/extend.png" alt="ouvrir" />
    </button>
  );
};

export default OpenWindowButton;
