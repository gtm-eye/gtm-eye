/* src/components/Tag.jsx */
/* global chrome */

import React, { useState, useMemo } from 'react';
import { Card, Form } from 'react-bootstrap';
import { AiOutlineInfoCircle } from 'react-icons/ai';
import { FaCloudUploadAlt } from 'react-icons/fa';
import TagDetailsModal     from './TagDetailsModal';
import ImageTagModal       from './ImageTagModal';
import ServerSideTagModal  from './ServerSideTagModal';
import '../styles/Tag.css';

const Tag = ({ tag, toggleActiveTags }) => {
  const unknownTag = './images/unknown.png';
  const [showModal, setShowModal] = useState(false);

  /* Helpers                                                             */
  const isServerSide = tag.sendsDataToServerSide === true;

  const isImageTag = useMemo(() => {
    const vtp = tag?.vtp || {};
    return (
      vtp.vtp_useImageTag === true ||
      vtp.vtp_transport   === 'image' ||
      vtp.vtp_tagType     === 'image' ||
      tag.type            === 'image' ||
      tag.function        === 'img'  ||
      (typeof tag.tag === 'string' && tag.tag.toLowerCase().includes('image'))
    );
  }, [tag]);

  const isHtmlTag    = tag?.vtp?.vtp_html !== undefined;

  /* Show info icon for every non-server tag EXCEPT “official, non-HTML” */
  const hasInfoModal =
    !isServerSide &&
    (isHtmlTag || isImageTag || !tag.official);

  const getTmb = () => {
    if (tag.tmb) {
      if (tag.official)                      return tag.tmb.text;
      if (tag.collision === 1 && tag.tmb[0]) return tag.tmb[0].name;
    }
    return unknownTag;
  };

  const getTitle = () => {
    if (tag.official)        return tag.tag;
    if (tag.collision === 1) return tag.tag[0];
    if (tag.collision > 1)   return `${tag.collision} possible Tags`;
    return 'Custom Tag';
  };

  return (
    <>
      <Card className={`tag-card text-center ${tag.isActive ? 'tag-active' : 'tag-inactive'}`}>
        {/* Icon opens the right modal */}
        {isServerSide ? (
          <FaCloudUploadAlt
            className="tag-info-button"
            title="View server-side details"
            onClick={e => { e.stopPropagation(); setShowModal(true); }}
          />
        ) : hasInfoModal && (
          <AiOutlineInfoCircle
            className="tag-info-button"
            title={
              isImageTag ? 'View image URL'
              : isHtmlTag ? 'View injected HTML'
              : 'View tag details'
            }
            onClick={e => { e.stopPropagation(); setShowModal(true); }}
          />
        )}

        <Card.Img variant="top" src={getTmb()} className="tag-icon" />

        <Card.Body>
          <Card.Title className="tag-title">{getTitle()}</Card.Title>
          <Form>
            <Form.Check
              type="switch"
              id={`toggle-${tag.tag_id}`}
              checked={tag.isActive}
              onChange={() => toggleActiveTags([tag], !tag.isActive)}
            />
          </Form>
        </Card.Body>
      </Card>

      {/* choose the correct modal */}
      {isServerSide ? (
        <ServerSideTagModal
          show={showModal}
          onHide={() => setShowModal(false)}
          tag={tag}
        />
      ) : isImageTag ? (
        <ImageTagModal
          show={showModal}
          onHide={() => setShowModal(false)}
          tag={tag}
        />
      ) : (
        <TagDetailsModal
          show={showModal}
          onHide={() => setShowModal(false)}
          tag={tag}
        />
      )}
    </>
  );
};

export default Tag;
