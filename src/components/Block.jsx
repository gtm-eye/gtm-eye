/* global chrome */

import { Row, Col, Form } from 'react-bootstrap';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../styles/Layout.css';
import MyExportButton from './MyExportButton';

function Block({
  selectedGtm,
  gtms,
  setSelectedGtm,
  setGtms,
  showTree,
  setshowTree,
  pageUrl
}) {
  // Handle the switch to unblock the selected GTM
  const toggleBlocked = () => {
    if (selectedGtm.isBlocked) {
      const updated = { ...selectedGtm, isBlocked: false };
      setSelectedGtm(updated);
      setGtms((prev) => prev.map((g) => (g.url === updated.url ? updated : g)));
      chrome.runtime.sendMessage({ type: 'updateGtm', updatedGtm: updated });
      chrome.runtime.sendMessage({ type: 'allowGTM', gtm: updated });
    }
  };

  // Handle dropdown selection of GTM
  const handleGtmChange = (e) => {
    const found = gtms.find((g) => g.url === e.target.value);
    setSelectedGtm(found);
  };

  return (
    <div className="px-2">
      {/* Row 1: GTM container selector */}
      <Row className="mt-1 py-0">
        <Col xs="auto" className="d-flex align-items-center">
          <Form.Label className="fw-semibold me-2 mb-0 gtm-label">
            GTM container:
          </Form.Label>

          <Form.Control
            as="select"
            value={selectedGtm.url}
            onChange={handleGtmChange}
            className="gtm-select"
            style={{ width: 180 }}
          >
            {gtms.map((gtm) => (
              <option key={gtm.url} value={gtm.url}>
                GTM-{gtm.id}
              </option>
            ))}
          </Form.Control>
        </Col>
      </Row>

      {/* Row 2: Activation switch and Export button */}
      <Row className="mt-2 py-0">
        <Col xs="auto" className="d-flex align-items-center">
          <Form.Check
            type="switch"
            id="toggleBlocked"
            checked={!selectedGtm.isBlocked}
            onChange={toggleBlocked}
            label="Activate"
            className="toggle-blocked me-3"
          />

          <MyExportButton gtms={gtms} pageUrl={pageUrl} />
        </Col>
      </Row>
    </div>
  );
}

export default Block;
