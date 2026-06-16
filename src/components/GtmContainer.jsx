import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import TagGroup from './TagGroup';

/**
 * Affiche les différents groupes de tags d’un conteneur GTM.
 * L’ordre :
 *   1. Server-Side Tags
 *   2. Official Tags
 *   3. Gallery Tags
 *   4. Image Tags
 *   5. HTML Tags
 */
const GtmContainer = ({
  serverTags,        // ⇦ nouveau groupe
  officialTags,
  galleryTags,
  htmlTags,
  imageTags,
  toggleActiveTags
}) => (
  <Container fluid className="gtm-container px-3 py-3">

    {/* Server-Side Tags */}
    <Row className="mb-3">
      <Col>
        <TagGroup
          title="Collector Tag (for ServerSide GTM)"
          tags={serverTags}
          toggleActiveTags={toggleActiveTags}
        />
      </Col>
    </Row>

    {/* Official Tags */}
    <Row className="mb-3">
      <Col>
        <TagGroup
          title="Official Tags"
          tags={officialTags}
          toggleActiveTags={toggleActiveTags}
        />
      </Col>
    </Row>

    {/* Gallery Tags */}
    <Row className="mb-3">
      <Col>
        <TagGroup
          title="Gallery Tags"
          tags={galleryTags}
          toggleActiveTags={toggleActiveTags}
        />
      </Col>
    </Row>

    {/* Image Tags */}
    <Row className="mb-3">
      <Col>
        <TagGroup
          title="Image Tags"
          tags={imageTags}
          toggleActiveTags={toggleActiveTags}
        />
      </Col>
    </Row>

    {/* HTML Tags */}
    <Row>
      <Col>
        <TagGroup
          title="HTML Tags"
          tags={htmlTags}
          toggleActiveTags={toggleActiveTags}
        />
      </Col>
    </Row>
  </Container>
);

export default GtmContainer;
