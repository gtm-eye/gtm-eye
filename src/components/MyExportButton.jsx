import React from 'react';
import { Button } from 'react-bootstrap';
import { FaCloudDownloadAlt } from 'react-icons/fa';

/**
 * Export detected GTMs to a downloadable JSON file.
 * Filename and JSON content include a timestamp.
 */
const MyExportButton = ({ gtms = [], pageUrl = '' }) => {
  // Extract "example.com" from "https://www.example.com/…"
  const getHostName = (url) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./i, '');
    } catch {
      return 'export';
    }
  };

  // Get current timestamp as "YYYYMMDD-HHMMSS"
  const getTimestamp = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  };

  // Build export structure with metadata + GTMs
  const buildPayload = () => ({
    timestamp: getTimestamp(),
    site: getHostName(pageUrl),
    gtmCount: gtms.length,
    containers: gtms.map((gtm) => ({
      id: gtm.id,
      url: gtm.url,
      isBlocked: gtm.isBlocked,
      obfuscation: gtm.obfuscation,
      tags: (gtm.tags || []).map((t) => ({
        tag_id: t.tag_id,
        isActive: t.isActive,
        name: Array.isArray(t.tag) ? t.tag[0] : t.tag || 'Unknown',
        type: t.official ? 'official' : t.collision > 1 ? 'gallery' : 'custom',
      })),
    })),
  });

  // Trigger file download
  const handleExport = () => {
    const timestamp = getTimestamp();
    const site = getHostName(pageUrl);
    const fileName = `${site}_${timestamp}.json`;

    const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), {
      href: url,
      download: fileName,
    });
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline-secondary" size="sm" onClick={handleExport}>
      <FaCloudDownloadAlt className="me-1" /> Download GTMs
    </Button>
  );
};

export default MyExportButton;
