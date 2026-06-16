import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import HtmlModal from './HtmlModal';
import GalleryTagModal from './GalleryTagModal';
import UnknownTagModal from './UnknownTagModal';

const TagDetailsModal = ({ show, onHide, tag, isImage = false }) => {
  const getImageUrl = () => {
    const vtp = tag?.vtp || {};
    return (
      vtp.vtp_image_url ??
      vtp.vtp_url ??
      tag.url ??
      vtp.vtp_customImageUrl ??
      ''
    ).toString();
  };

  const imageUrl = getImageUrl();
  const isHttp = imageUrl.startsWith('http');

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Tag Details</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {isImage ? (
          <>
            <h5>Image Tag</h5>
            <p><strong>URL :</strong></p>
            <pre>{isHttp ? imageUrl : '(URL introuvable)'}</pre>
            {isHttp && (
              <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                Ouvrir dans un nouvel onglet
              </a>
            )}
          </>
        ) : (
          tag.official
            ? <HtmlModal htmlTag={tag} />
            : (tag.collision === -1
                ? <UnknownTagModal tag={tag} />
                : <GalleryTagModal tag={tag} />)
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TagDetailsModal;
