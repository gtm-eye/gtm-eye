/* src/components/ServerSideTagModal.jsx */

import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { FaCloudUploadAlt } from 'react-icons/fa';

const ServerSideTagModal = ({ show, onHide, tag }) => {
  // Extract server-side destination URL
  const raw = tag?.sendsDataToServerSideInfo;
  const urlStr = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '');

  const hasProtocol = urlStr.startsWith('http://') || urlStr.startsWith('https://');
  const clickUrl = hasProtocol ? urlStr : urlStr ? `https://${urlStr}` : null;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <FaCloudUploadAlt className="me-2" />
          Server-Side Tag
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p><strong>Tag ID:</strong> {tag.tagIdGtm}</p>

        <p className="mb-1"><strong>Server URL:</strong></p>
        <pre className="bg-light p-2 rounded text-break">
          {urlStr || '(Unknown URL)'}
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

export default ServerSideTagModal;
