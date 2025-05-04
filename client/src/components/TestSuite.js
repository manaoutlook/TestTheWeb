import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TestCase from './TestCase';
import { FiChevronDown, FiChevronRight, FiPlus, FiTrash2 } from 'react-icons/fi';

const TestSuite = () => {
  const [testSuites, setTestSuites] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTestSuite, setNewTestSuite] = useState({
    name: '',
    description: ''
  });
  const [expandedSuites, setExpandedSuites] = useState({});

  useEffect(() => {
    fetchTestSuites();
  }, []);

  const fetchTestSuites = async () => {
    try {
      const response = await axios.get('/api/testsuites');
      setTestSuites(response.data);
      // Initialize all suites as collapsed by default
      setExpandedSuites({});
    } catch (error) {
      console.error('Error fetching test suites:', error);
    }
  };

  const toggleSuite = (suiteId) => {
    setExpandedSuites({
      ...expandedSuites,
      [suiteId]: !expandedSuites[suiteId]
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTestSuite({ ...newTestSuite, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/testsuites', newTestSuite);
      fetchTestSuites();
      setNewTestSuite({ name: '', description: '' });
    } catch (error) {
      console.error('Error creating test suite:', error);
    }
  };

  const deleteTestSuite = async (suiteId) => {
    try {
      await axios.delete(`/api/testsuites/${suiteId}`);
      fetchTestSuites();
    } catch (error) {
      console.error('Error deleting test suite:', error);
    }
  };

  return (
    <div className="test-suite-container">
      <div className="add-suite-controls">
        <button 
          onClick={() => setShowAddModal(true)}
          className="primary-button"
        >
          <FiPlus /> Add Test Suite
        </button>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Create New Test Suite</h3>
            <form onSubmit={(e) => {
              handleSubmit(e);
              setShowAddModal(false);
            }} className="suite-form">
              <div className="form-group">
                <label>Suite Name</label>
                <input
                  type="text"
                  name="name"
                  value={newTestSuite.name}
                  onChange={handleInputChange}
                  placeholder="Enter suite name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={newTestSuite.description}
                  onChange={handleInputChange}
                  placeholder="Describe this test suite"
                  rows="3"
                />
              </div>
              <div className="modal-buttons">
                <button type="submit" className="primary-button">
                  Create
                </button>
                <button 
                  type="button" 
                  className="secondary-button"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="suites-list">
        <h3 className="section-title">Your Test Suites</h3>
        {testSuites.length === 0 ? (
          <p className="empty-state">No test suites yet. Create your first one!</p>
        ) : (
          testSuites.map((suite) => (
            <div key={suite._id} className="suite-card">
              <div 
                className="suite-header"
                onClick={() => toggleSuite(suite._id)}
              >
                {expandedSuites[suite._id] ? (
                  <FiChevronDown className="collapse-icon" />
                ) : (
                  <FiChevronRight className="collapse-icon" />
                )}
                <h4 className="suite-name">{suite.name}</h4>
                <button 
                  className="delete-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Are you sure you want to delete this test suite and all its test cases?')) {
                      deleteTestSuite(suite._id);
                    }
                  }}
                  style={{
                    marginLeft: 'auto',
                    padding: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: '#ff4444',
                    cursor: 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <FiTrash2 />
                  <span style={{ marginLeft: '5px' }}>Delete</span>
                </button>
              </div>
              
              {expandedSuites[suite._id] && (
                <div className="suite-content">
                  {suite.description && <p className="suite-description">{suite.description}</p>}
                  <TestCase testSuiteId={suite._id} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TestSuite;
