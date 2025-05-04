import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './TestCase.css';

const TestCase = ({ testSuiteId }) => {
  const [testCases, setTestCases] = useState([]);
  const [newTestCase, setNewTestCase] = useState({
    name: '',
    description: '',
    targetUrl: '',
    steps: []
  });
  const [isRecording, setIsRecording] = useState(false);
  const [recordedSteps, setRecordedSteps] = useState([]);
  const [targetWindow, setTargetWindow] = useState(null);
  const [windowReady, setWindowReady] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    fetchTestCases();
    
    // Clean up on unmount
    return () => {
      if (targetWindow && !targetWindow.closed) {
        targetWindow.close();
      }
      window.removeEventListener('message', handleMessage);
    };
  }, [testSuiteId]);

  const handleMessage = (event) => {
    if (!isRecording || (targetWindow && event.source !== targetWindow)) return;
      
    const { data } = event;
    let newStep;
    
    switch(data.type) {
      case 'click':
        newStep = {
          type: 'click',
          timestamp: Date.now(),
          description: `Clicked on ${data.target.toLowerCase()}`,
          selector: data.id ? `#${data.id}` : 
                   data.name ? `[name="${data.name}"]` : 
                   data.target.toLowerCase()
        };
        break;
        
      case 'submit':
        newStep = {
          type: 'submit',
          timestamp: Date.now(),
          description: `Submitted form ${data.id || data.name || 'unnamed form'}`,
          selector: data.id ? `#${data.id}` : 
                   data.name ? `[name="${data.name}"]` : 
                   data.target.toLowerCase()
        };
        break;
        
      case 'change':
        newStep = {
          type: 'change',
          timestamp: Date.now(),
          description: `Changed ${data.name || data.id || 'field'} to ${data.value}`,
          selector: data.id ? `#${data.id}` : 
                   data.name ? `[name="${data.name}"]` : 
                   data.target.toLowerCase()
        };
        break;
    }
    
    if (newStep) {
      setRecordedSteps(prev => [...prev, newStep]);
    }
  };

  window.addEventListener('message', handleMessage);

  const fetchTestCases = async () => {
    try {
      const url = testSuiteId 
        ? `http://localhost:3101/api/testcases?testSuiteId=${testSuiteId}`
        : 'http://localhost:3101/api/testcases';
      console.log('Fetching test cases from:', url);
      const response = await axios.get(url);
      console.log('Fetched test cases:', response.data);
      setTestCases(response.data);
    } catch (error) {
      console.error('Error fetching test cases:', error.response?.data || error.message);
      alert(`Failed to load test cases: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTestCase({ ...newTestCase, [name]: value });
  };

  const startRecording = () => {
    if (!newTestCase.targetUrl) return;
    
    // Open new window for recording
    const win = window.open(newTestCase.targetUrl, '_blank');
    if (!win) {
      alert('Popup was blocked. Please allow popups for this site.');
      return;
    }
    
    setTargetWindow(win);
    setIsRecording(true);
    setRecordedSteps([]);
  };

  const takeScreenshot = async () => {
    if (!isRecording || !newTestCase.targetUrl) return;
    
    try {
      const response = await axios.get(
        `http://localhost:3101/api/screenshot?url=${encodeURIComponent(newTestCase.targetUrl)}`,
        { responseType: 'blob' }
      );
      
      const reader = new FileReader();
      reader.onload = () => {
        setRecordedSteps(prev => [...prev, {
          type: 'screenshot',
          timestamp: Date.now(),
          description: `Screenshot at ${new Date().toLocaleTimeString()}`,
          screenshot: reader.result
        }]);
      };
      reader.readAsDataURL(response.data);
    } catch (error) {
      console.error('Error capturing screenshot:', error);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    setNewTestCase(prev => ({
      ...prev,
      steps: [...recordedSteps]
    }));
    if (targetWindow && !targetWindow.closed) {
      targetWindow.close();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Validate required fields
      if (!newTestCase.name || !newTestCase.targetUrl) {
        alert('Please fill in all required fields');
        return;
      }

      const payload = {
        name: newTestCase.name,
        description: newTestCase.description,
        targetUrl: newTestCase.targetUrl,
        steps: [...recordedSteps],
        ...(testSuiteId && { testSuiteId })
      };

      console.log('Saving test case with payload:', payload);
      
      const response = await axios.post('http://localhost:3101/api/testcases', payload);
      console.log('Save successful:', response.data);
      
      fetchTestCases();
      setNewTestCase({
        name: '',
        description: '',
        targetUrl: '',
        steps: []
      });
      setRecordedSteps([]);
      alert('Test case saved successfully!');
    } catch (error) {
      console.error('Error creating test case:', error.response?.data || error.message);
      alert(`Failed to save test case: ${error.response?.data?.message || error.message}`);
    }
  };

  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="test-case-container">
      <div className="test-case-header">
        <h3>Test Cases</h3>
        <button 
          onClick={() => setShowAddModal(true)}
          className="primary-button"
        >
          Add Test Case
        </button>
      </div>

      <div className="test-cases-list">
        {testCases.length > 0 ? (
          testCases.map(testCase => (
            <div key={testCase._id} className="test-case-card">
              <div className="card-header">
                <h4 className="card-title">{testCase.name}</h4>
                <span className="steps-badge">{testCase.steps.length} steps</span>
              </div>
              <div className="card-body">
                <p className="card-description">{testCase.description}</p>
                <div className="card-footer">
                  <span className="url-label">Target URL:</span>
                  <a href={testCase.targetUrl} target="_blank" rel="noopener noreferrer" className="url-link">
                    {testCase.targetUrl}
                  </a>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="empty-state">No test cases yet. Create your first one!</p>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h4>Create New Test Case</h4>
              <button 
                className="close-button"
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e);
                  setShowAddModal(false);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Name:</label>
                  <input
                    type="text"
                    name="name"
                    value={newTestCase.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Description:</label>
                  <textarea
                    name="description"
                    value={newTestCase.description}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Target Website URL:</label>
                  <input
                    type="url"
                    name="targetUrl"
                    value={newTestCase.targetUrl}
                    onChange={handleInputChange}
                    required
                    placeholder="https://example.com"
                  />
                </div>
                <div className="recording-controls">
                  {!isRecording ? (
                    <button 
                      type="button" 
                      onClick={startRecording}
                      className="primary-button"
                      disabled={!newTestCase.targetUrl}
                    >
                      Start Recording
                    </button>
                  ) : (
                    <>
                      <button 
                        type="button" 
                        onClick={takeScreenshot}
                        className="secondary-button"
                      >
                        Take Screenshot
                      </button>
                      <button 
                        type="button" 
                        onClick={stopRecording}
                        className="stop-button"
                      >
                        Stop Recording
                      </button>
                    </>
                  )}
                </div>

                <div className="window-status">
                  {targetWindow && !targetWindow.closed ? (
                    <span className="status-connected">✔ Connected to target window</span>
                  ) : (
                    <span className="status-disconnected">Target window not connected</span>
                  )}
                </div>

                <button 
                  type="submit" 
                  className="save-button primary-button"
                  disabled={!newTestCase.name || !newTestCase.targetUrl}
                >
                  Save Test Case
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestCase;
