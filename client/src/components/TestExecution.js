import React, { useState } from 'react';
import axios from 'axios';
import { FiPlay, FiStopCircle, FiCheck, FiX } from 'react-icons/fi';

const TestExecution = ({ testCaseId }) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState(null);
  const [results, setResults] = useState([]);

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
          <h4>Results:</h4>
          <ul>
            {results.map((result, index) => (
              <li key={index} className={result.success ? 'success' : 'failure'}>
                {result.success ? <FiCheck /> : <FiX />}
                Step {index + 1}: {result.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TestExecution;
