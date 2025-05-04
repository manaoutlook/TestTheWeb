import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiPlay, FiStopCircle, FiCheck, FiX } from 'react-icons/fi';

const TestExecution = ({ testCaseId }) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState(null);
  const [results, setResults] = useState([]);
  const [testCase, setTestCase] = useState(null);

  useEffect(() => {
    const fetchTestCase = async () => {
      if (!testCaseId) {
        console.log('No testCaseId provided');
        setTestCase(null);
        return;
      }

      try {
        console.log('Fetching test case with ID:', testCaseId);
        const response = await axios.get(`http://localhost:3101/api/testcases/${testCaseId}`, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        if (!response.data) {
          throw new Error('Empty response data');
        }

        console.log('Full API response:', response);
        if (!response.data.name) {
          console.warn('Test case data missing name field:', response.data);
          throw new Error('Test case name missing in response');
        }
        setTestCase(response.data);
      } catch (error) {
        console.error('Error fetching test case:', error);
        const initialResponse = error.response;
        console.log('Attempting to fetch test case name separately...');
        try {
          const nameResponse = await axios.get(`/api/testcases/${testCaseId}/name`);
          setTestCase({
            name: nameResponse.data.name || `Test Case ${testCaseId}`,
            description: initialResponse?.data?.description || 'Details unavailable',
            steps: initialResponse?.data?.steps || [],
            targetUrl: initialResponse?.data?.targetUrl || 'about:blank'
          });
        } catch (nameError) {
          console.error('Failed to fetch test case name:', nameError);
          setTestCase({
            name: 'Test Case - Server Not Available',
            description: 'Please start the backend server to view test case details',
            steps: [],
            targetUrl: 'about:blank'
          });
        }
      }
    };
    
    fetchTestCase();
  }, [testCaseId]);

  console.log('Current testCase:', testCase);

  const startExecution = async () => {
    try {
      setIsExecuting(true);
      setExecutionStatus('running');
      
      const response = await axios.post('/api/executions', {
        testCaseId,
      });

      // Poll for execution status
      const pollStatus = async (executionId) => {
        const { data } = await axios.get(`/api/executions/${executionId}`);
        if (data.status === 'completed' || data.status === 'failed') {
          setIsExecuting(false);
          setExecutionStatus(data.status);
          setResults(data.results || []);
        } else {
          setTimeout(() => pollStatus(executionId), 1000);
        }
      };

      pollStatus(response.data._id);
    } catch (error) {
      console.error('Execution error:', error);
      setIsExecuting(false);
      setExecutionStatus('failed');
    }
  };

  const stopExecution = async () => {
    try {
      await axios.post('/api/executions/stop');
      setIsExecuting(false);
      setExecutionStatus('stopped');
    } catch (error) {
      console.error('Stop execution error:', error);
    }
  };

  return (
    <div className="test-execution">
      <h3>Test Execution</h3>
      
      {testCase && (
        <div className="test-case-info">
          <h4>{testCase.name}</h4>
          {testCase.description && <p>{testCase.description}</p>}
          <div className="test-case-meta">
            <span>Steps: {testCase.steps.length}</span><br />
            <span>Target URL: <a href={testCase.targetUrl} target="_blank" rel="noopener">{testCase.targetUrl}</a></span>
          </div>
        </div>
      )}

      <div className="execution-controls">
        {!isExecuting ? (
          <button 
            onClick={startExecution}
            className="primary-button"
            disabled={!testCaseId}
          >
            <FiPlay /> Start Execution
          </button>
        ) : (
          <button 
            onClick={stopExecution}
            className="stop-button"
          >
            <FiStopCircle /> Stop Execution
          </button>
        )}
      </div>

      {executionStatus && (
        <div className={`execution-status ${executionStatus}`}>
          Status: {executionStatus}
        </div>
      )}

      {results.length > 0 && (
        <div className="execution-results">
          <h4>Execution Details:</h4>
          <div className="execution-steps">
            {results.map((result, index) => (
              <div key={index} className={`step-result ${result.success ? 'success' : 'failure'}`}>
                <div className="step-header">
                  {result.success ? <FiCheck className="status-icon" /> : <FiX className="status-icon" />}
                  <span className="step-number">Step {index + 1}</span>
                  <span className="step-description">{result.message}</span>
                </div>
                {result.screenshot && (
                  <div className="step-screenshot">
                    <img src={result.screenshot} alt={`Step ${index + 1} screenshot`} />
                    <div className="step-marker" style={{
                      position: 'absolute',
                      left: `${result.targetX}px`,
                      top: `${result.targetY}px`,
                      width: '24px',
                      height: '24px',
                      backgroundColor: 'rgba(255, 0, 0, 0.5)',
                      border: '2px solid red',
                      borderRadius: '50%',
                      transform: 'translate(-50%, -50%)',
                      pointerEvents: 'none',
                      boxShadow: '0 0 0 2px white',
                      zIndex: 100
                    }} title={`Action at (${Math.round(result.targetX)}, ${Math.round(result.targetY)})`}></div>
                  </div>
                )}
                {result.details && (
                  <div className="step-details">
                    <pre>{JSON.stringify(result.details, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestExecution;
