import React, { useState, useEffect } from 'react';
import { Alert, Form, Card } from 'react-bootstrap';
import '../styles/Layout.css';
import Tag from './Tag';

const TagGroup = ({ title, tags, toggleActiveTags }) => {
  const [active, setActive] = useState(true);

  // Update group toggle state when tags change
  useEffect(() => {
    setActive(tags.some(tag => tag.isActive));
  }, [tags]);

  return (
    <Card className="tag-group-card p-3 mb-3">
      {/* Header: title and group switch */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5 className="mb-0">{title} ({tags.length})</h5>
        {tags.length > 0 && (
          <Form className="mb-0">
            <Form.Check
              type="switch"
              id={`toggleAll-${title}`}
              checked={active}
              onChange={() => toggleActiveTags(tags, !active)}
              label="Enable / Disable all"
              className="mb-0"
            />
          </Form>
        )}
      </div>

      {/* Tags row or empty message */}
      {tags.length === 0 ? (
        <Alert variant="warning" className="text-center my-2">
          No tags detected.
        </Alert>
      ) : (
        <div className="d-flex flex-wrap gap-2">
          {tags.map((tag, idx) => (
            <Tag key={`${tag.tag_id}-${idx}`} tag={tag} toggleActiveTags={toggleActiveTags} />
          ))}
        </div>
      )}
    </Card>
  );
};

export default TagGroup;
