/* src/components/ImageTagModal.jsx */

import React from 'react';
import { Modal, Button } from 'react-bootstrap';

/**
 * Dedicated modal for “Image Tag” pixels.
 * Displays the pixel URL extracted in the background script.
 */
const ImageTagModal = ({ show, onHide, tag }) => {
  const urlCandidate =
    tag.url ||                         // set by background.js
    tag.imageUrl ||                    // raw parser for __img
    tag.vtp?.vtp_url ||                // official / gallery templates
    tag.vtp?.vtp_image_url ||          // alternate key
    tag.vtp?.vtp_pixel_url ||          // custom templates
    '';                                // fallback

  /* Always coerce to string so startsWith is safe */
  const url = typeof urlCandidate === 'string'
    ? urlCandidate
    : String(urlCandidate ?? '');

  const isWebUrl =
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('//');

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Image Tag</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p><strong>Pixel URL:</strong></p>
        <pre className={`p-2 ${isWebUrl ? 'bg-light' : 'bg-warning text-dark'}`}>
          {url || '(URL not found)'}
        </pre>

       
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ImageTagModal;
