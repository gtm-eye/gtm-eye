/* global chrome */

import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useEffect, useState } from 'react';
import Block from './components/Block';
import Loading from './components/Loading';
import { Container } from 'react-bootstrap';
import GtmContainer from './components/GtmContainer';
import InjectionTree from './components/InjectionTree';
import CopyRight from './components/CopyRight';
import OpenWindowButton from './components/OpenInWindow';
import MyExportButton from './components/MyExportButton';
import { Row, Col } from 'react-bootstrap';

function App() {
  const [gtms, setGtms] = useState([]);
  const [selectedGtm, setSelectedGtm] = useState({});
  const [officialTags, setOfficialTags] = useState([]);
  const [galleryTags, setGalleryTags] = useState([]);
  const [htmlTags, setHtmlTags] = useState([]);
  const [imageTags, setImageTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTree, setshowTree] = useState(false);
  const [pageUrl, setPageUrl] = useState('');
  const [serverTags, setServerTags] = useState([]);

  // Helper: check if a tag is an image type
  const isImageTag = (tag) => {
    const vtp = tag.vtp || {};
    return (
      vtp.vtp_useImageTag === true ||
      vtp.vtp_transport === 'image' ||
      (typeof tag.tag === 'string' && tag.tag.toLowerCase().includes('image'))
    );
  };

  // Toggle active status of a list of tags
  const toggleActiveTags = (tags, state) => {
    if (selectedGtm.isBlocked) {
      const newTags = selectedGtm.tags.map(t =>
        tags.map(tag => tag.tag_id).includes(t.tag_id) ? { ...t, isActive: state } : t
      );
      const updatedGtm = { ...selectedGtm, tags: newTags };
      updateGtmFrontEnd(updatedGtm);
      updateContentScript(updatedGtm);
    }
  };

  // Update frontend state with modified GTM
  const updateGtmFrontEnd = (updatedGtm) => {
    setSelectedGtm(updatedGtm);
    setGtms(prevGtms =>
      prevGtms.map(gtm => gtm.url === updatedGtm.url ? updatedGtm : gtm)
    );
  };

  // Send updated GTM data to content script
  const updateContentScript = (updatedGtm) => {
    chrome.runtime.sendMessage({ type: 'updateGtm', updatedGtm });
  };

  // Handle messages from background script
  const handleMessage = (msg) => {
    if (msg.type === 'newGtm') {
      setGtms(prev => {
        const exists = prev.some(gtm => gtm.id === msg.gtm.id);
        return exists ? prev : [...prev, msg.gtm];
      });
    } else if (msg.type === 'injectionTree') {
      updateGtmFrontEnd(msg.gtm);
    } else if (msg.type === 'pageUrl') {
      if (msg.url && msg.url !== pageUrl) setPageUrl(msg.url);
    }
  };

  // On popup load: get tab info and real URL
  useEffect(() => {
    const isPopup = new URLSearchParams(window.location.search).has('standalone');
    if (isPopup) {
      chrome.runtime.sendMessage({ type: 'setTargetTab' });
      chrome.runtime.sendMessage({ type: 'getRealTabInfo' }, (tabInfo) => {
        if (tabInfo?.url) setPageUrl(tabInfo.url);
      });
    }
  }, []);

  // Reload GTM data when URL changes
  useEffect(() => {
    if (!pageUrl) return;
    setLoading(true);
    reinitContainer();
    setSelectedGtm({});

    chrome.runtime.sendMessage({ type: 'updateBlockeds' }, (resp) => {
      setGtms(resp || []);
      setLoading(false);
      if (Array.isArray(resp) && resp.length > 0) {
        const first = resp[0];
        setSelectedGtm(first);
        reinitContainer();
        first.tags?.forEach(tag => addTag(tag));
      }
    });
  }, [pageUrl]);

  // Reset all tag categories
  const reinitContainer = () => {
    setOfficialTags([]);
    setGalleryTags([]);
    setHtmlTags([]);
    setImageTags([]);
    setServerTags([]);
  };

  // Check if tag is already added
  const alreadyIn = (arr, tag) => arr.some(t => t.tag_id === tag.tag_id);

  // Sort tag into the correct category
  const addTag = (tag) => {
    if (!tag) return;

    if (tag.sendsDataToServerSide === true) {
      setServerTags(prev => alreadyIn(prev, tag) ? prev : [...prev, tag]);
      return;
    }

    const vtp = tag.vtp || {};
    const isImage = isImageTag(tag);
    const isHtml = vtp.vtp_html !== undefined;

    if (tag.official && !isImage && !isHtml && (tag.tmb || tag.tag === 'Zone')) {
      setOfficialTags(prev => alreadyIn(prev, tag) ? prev : [...prev, tag]);
    }
    if (!tag.official) {
      setGalleryTags(prev => alreadyIn(prev, tag) ? prev : [...prev, tag]);
    }
    if (isHtml) {
      setHtmlTags(prev => alreadyIn(prev, tag) ? prev : [...prev, tag]);
    }
    if (isImage) {
      setImageTags(prev => alreadyIn(prev, tag) ? prev : [...prev, tag]);
    }
  };

  // Update tag display when GTM selection changes
  const updateGtm = () => {
    reinitContainer();
    if (selectedGtm?.tags) {
      selectedGtm.tags.forEach(tag => addTag(tag));
    }
  };

  useEffect(() => {
    updateGtm();
  }, [selectedGtm]);

  // Auto-select the first GTM if none is selected
  useEffect(() => {
    if (gtms.length > 0 && !(selectedGtm && selectedGtm.tags)) {
      setSelectedGtm(gtms[0]);
    }
  }, [gtms]);

  // On first load: get GTMs, URL, and listen to background
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'getGtms' }, (resp) => {
      if (Array.isArray(resp) && resp.length > 0) setGtms(resp);
      setLoading(false);
    });

    chrome.runtime.sendMessage({ type: 'getPageInfo' }, (info) => {
      if (info?.url) setPageUrl(info.url);
    });

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  if (loading) return <Loading />;

  return (
    <div style={{ position: 'relative' }}>
      <OpenWindowButton />

      {/* Top header with copyright and current page URL */}
      <div className="top-row d-flex justify-content-between align-items-center px-2 pt-2">
        <CopyRight />
        {pageUrl && (
          <div className="url-banner no-overlap">
            <strong>Page :</strong>
            <a href={pageUrl} target="_blank" rel="noopener noreferrer">
              {pageUrl}
            </a>
          </div>
        )}
      </div>

      {/* GTM selector and switch (in Block component) */}
      {gtms.length > 0 && (
        <div className="px-2 pt-1">
          <Block
            selectedGtm={selectedGtm}
            gtms={gtms}
            setSelectedGtm={setSelectedGtm}
            setGtms={setGtms}
            showTree={showTree}
            setshowTree={setshowTree}
            pageUrl={pageUrl}
          />
        </div>
      )}

      {/* Main tag display container */}
      <Container style={{ minWidth: '750px', marginTop: '10px' }}>
        <div className="mt-3">
          {showTree ? (
            <InjectionTree tree={selectedGtm.tree} />
          ) : (
            <GtmContainer
              officialTags={officialTags}
              galleryTags={galleryTags}
              htmlTags={htmlTags}
              imageTags={imageTags}
              serverTags={serverTags}
              toggleActiveTags={toggleActiveTags}
            />
          )}
        </div>
      </Container>
    </div>
  );
}

export default App;
