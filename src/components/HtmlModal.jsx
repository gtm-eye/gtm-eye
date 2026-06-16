import React from 'react';

const HtmlModal = ({htmlTag}) => {
    return (
        <>
            <h4 className="mb-3">{htmlTag.tag}</h4>
            <p><strong>Injected HTML:</strong></p>
            <pre className="bg-light p-3 rounded">{htmlTag.vtp.vtp_html}</pre>
        </>
    );
}

export default HtmlModal;
