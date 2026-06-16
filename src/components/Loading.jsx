// src/components/Loading.js
import React from 'react';
import { Container, Spinner } from 'react-bootstrap';

const Loading = () => {
  return (
    <Container style={{ minWidth: '800px', margin: "10px", textAlign: 'center' }}>
      <Spinner animation="border" role="status">
        <span className="sr-only">Analysing...</span>
      </Spinner>
      <p>Analysing...</p>
    </Container>
  );
};

export default Loading;
