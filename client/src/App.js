import React, { useState, useEffect } from 'react';
import './App.css';
import TestSuite from './components/TestSuite';
import TestExecution from './components/TestExecution';

function App() {
  const [iframeUrl, setIframeUrl] = useState('');

  useEffect(() => {
    // Set default URL to empty
    setIframeUrl('');
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Web Application Testing Tool</h1>
        <div className="app-container">
          <div className="test-case-management">
            <h2>Test Suite Management</h2>
            <TestSuite />
          </div>
          <div className="test-execution">
            <h2>Test Execution</h2>
            <div className="execution-container">
              <div className="execution-controls">
                <TestExecution />
              </div>
              <div className="iframe-container">
                <iframe 
                  src={`http://localhost:3101/api/proxy?url=${encodeURIComponent(iframeUrl)}`}
                  title="Website Preview"
                  width="100%"
                  height="500px"
                  frameBorder="0"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
              </div>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;
