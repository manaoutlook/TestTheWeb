const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3101;

// Middleware
app.use(cors({
  origin: 'http://localhost:3102',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Database connection
mongoose.connect('mongodb://localhost:27017/testtheweb', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('Connected to MongoDB');
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    const testCasesExist = collections.some(c => c.name === 'testcases');
    console.log('Test cases collection exists:', testCasesExist);
  } catch (err) {
    console.error('Error checking collections:', err);
  }
})
.catch(err => console.error('MongoDB connection error:', err));

// Test Suite Model
const testStepSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['click', 'input', 'navigation', 'screenshot'] },
  timestamp: { type: Date, required: true },
  description: { type: String, required: true },
  selector: String,
  value: String,
  url: String,
  screenshot: String, // Base64 encoded screenshot
  order: { type: Number, required: true }
});

const testCaseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  targetUrl: { type: String, required: true },
  steps: [testStepSchema],
  createdAt: { type: Date, default: Date.now }
});

const testSuiteSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  testCases: [testCaseSchema],
  createdAt: { type: Date, default: Date.now }
});

const TestSuite = mongoose.model('TestSuite', testSuiteSchema);
const TestCase = mongoose.model('TestCase', testCaseSchema);

// API Routes
// Test Suites
app.get('/api/testsuites', async (req, res) => {
  try {
    const testSuites = await TestSuite.find().populate('testCases');
    res.json(testSuites);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/testsuites', async (req, res) => {
  const testSuite = new TestSuite(req.body);
  try {
    const newTestSuite = await testSuite.save();
    res.status(201).json(newTestSuite);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Test Cases
app.get('/api/testcases', async (req, res) => {
  try {
    const testCases = await TestCase.find();
    res.json(testCases);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/testcases/:id', async (req, res) => {
  try {
    const testCase = await TestCase.findById(req.params.id);
    if (!testCase) {
      return res.status(404).json({ message: 'Test case not found' });
    }
    res.json(testCase);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/testcases', async (req, res) => {
  const testCase = new TestCase(req.body);
  try {
    const newTestCase = await testCase.save();
    
    // If testSuiteId is provided, add test case to test suite
    if (req.body.testSuiteId) {
      await TestSuite.findByIdAndUpdate(
        req.body.testSuiteId,
        { $push: { testCases: newTestCase._id } }
      );
    }
    
    res.status(201).json(newTestCase);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Test Steps
app.post('/api/testcases/:id/steps', async (req, res) => {
  try {
    const testCase = await TestCase.findByIdAndUpdate(
      req.params.id,
      { $push: { steps: req.body } },
      { new: true }
    );
    res.json(testCase);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/testsuites/:id', async (req, res) => {
  try {
    // First delete all test cases in this suite
    const suite = await TestSuite.findById(req.params.id);
    if (suite && suite.testCases.length > 0) {
      await TestCase.deleteMany({ _id: { $in: suite.testCases } });
    }
    
    // Then delete the test suite
    await TestSuite.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Test suite and all its test cases deleted successfully' });
  } catch (error) {
    console.error('Error deleting test suite:', error);
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/testcases/:id', async (req, res) => {
  try {
    const testCase = await TestCase.findByIdAndDelete(req.params.id);
    
    // Remove test case reference from any test suites
    await TestSuite.updateMany(
      { testCases: req.params.id },
      { $pull: { testCases: req.params.id } }
    );
    
    res.json({ message: 'Test case deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const { chromium } = require('playwright');

// Screenshot endpoint for headless browser
app.get('/api/screenshot', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('URL parameter is required');
  }

  try {
    // Verify URL is valid
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).send('Invalid URL protocol');
    }

    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Set viewport to common desktop size
    await page.setViewportSize({ width: 1280, height: 800 });
    
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 80,
      fullPage: false
    });
    
    await browser.close();

    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-cache'
    });
    res.send(screenshot);
  } catch (error) {
    console.error('Screenshot error:', error);
    res.status(500).send('Error capturing screenshot');
  }
});

const axios = require('axios');

// Proxy endpoints for iframe content
app.get('/api/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('URL parameter is required');
  }

  try {
    // Verify URL is valid
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).send('Invalid URL protocol');
    }

    // Fetch the target website
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Set CORS headers
    res.set({
      'Content-Type': response.headers['content-type'],
      'Access-Control-Allow-Origin': '*'
    });

    res.send(response.data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Error fetching website content');
  }
});

// Enhanced proxy endpoint with better error handling
app.get('/api/proxy/v2', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Verify URL is valid
    const parsedUrl = new URL(decodeURIComponent(url));
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'Invalid URL protocol' });
    }

    // Fetch the target website with timeout
    const response = await axios.get(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      timeout: 10000,
      maxRedirects: 5
    });

    // Set security headers
    res.set({
      'Content-Type': response.headers['content-type'] || 'text/html',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'ALLOW-FROM *',
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' *;"
    });

    // Modify response to handle relative URLs
    let content = response.data;
    if (response.headers['content-type']?.includes('text/html')) {
      content = content.replace(/<head>/, `<head><base href="${parsedUrl.protocol}//${parsedUrl.host}">`);
    }

    res.send(content);
  } catch (error) {
    console.error('Proxy v2 error:', error);
    const status = error.response?.status || 500;
    res.status(status).json({ 
      error: 'Error fetching website content',
      details: error.message 
    });
  }
});

// Execution Model
const executionSchema = new mongoose.Schema({
  testCaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestCase' },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'stopped'], default: 'pending' },
  results: [{
    stepId: mongoose.Schema.Types.ObjectId,
    success: Boolean,
    message: String,
    screenshot: String,
    timestamp: { type: Date, default: Date.now }
  }],
  startedAt: { type: Date, default: Date.now },
  completedAt: Date
});

const Execution = mongoose.model('Execution', executionSchema);

// Execution API Endpoints
app.post('/api/executions', async (req, res) => {
  try {
    const { testCaseId } = req.body;
    const testCase = await TestCase.findById(testCaseId);
    
    if (!testCase) {
      return res.status(404).json({ message: 'Test case not found' });
    }

    const execution = new Execution({
      testCaseId,
      status: 'pending'
    });
    
    await execution.save();

    // Start execution in background
    executeTestCase(execution._id, testCase);

    res.status(201).json(execution);
  } catch (error) {
    console.error('Error starting execution:', error);
    res.status(500).json({ message: error.message });
  }
});

async function executeTestCase(executionId, testCase) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await Execution.findByIdAndUpdate(executionId, { 
      status: 'running',
      startedAt: new Date()
    });

    const results = [];
    
    // Execute each test step
    for (const step of testCase.steps) {
      try {
        let result;
        
        switch(step.type) {
          case 'click':
            const clickElement = await page.$(step.selector);
            if (!clickElement) {
              throw new Error(`Element not found: ${step.selector}`);
            }
            const clickBox = await clickElement.boundingBox();
            await clickElement.click();
            result = { 
              success: true, 
              message: `Clicked ${step.selector}`,
              targetX: clickBox.x + clickBox.width/2,
              targetY: clickBox.y + clickBox.height/2
            };
            break;
            
          case 'input':
            const inputElement = await page.$(step.selector);
            if (!inputElement) {
              throw new Error(`Element not found: ${step.selector}`);
            }
            const inputBox = await inputElement.boundingBox();
            await inputElement.fill(step.value);
            result = { 
              success: true, 
              message: `Entered "${step.value}" in ${step.selector}`,
              targetX: inputBox.x + inputBox.width/2,
              targetY: inputBox.y + inputBox.height/2
            };
            break;
            
          case 'navigation':
            await page.goto(step.url);
            result = { success: true, message: `Navigated to ${step.url}` };
            break;
            
          case 'screenshot':
            const screenshot = await page.screenshot({ fullPage: true });
            result = { 
              success: true, 
              message: 'Screenshot captured',
              screenshot: screenshot.toString('base64'),
              targetX: 0,
              targetY: 0 
            };
            break;
        }
        
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          message: `Failed to execute step: ${error.message}`
        });
      }
    }

    await Execution.findByIdAndUpdate(executionId, {
      status: 'completed',
      results,
      completedAt: new Date()
    });
    
  } catch (error) {
    await Execution.findByIdAndUpdate(executionId, {
      status: 'failed',
      results: [{
        success: false,
        message: `Execution failed: ${error.message}`
      }]
    });
  } finally {
    await browser.close();
  }
}

app.get('/api/executions/:id', async (req, res) => {
  try {
    const execution = await Execution.findById(req.params.id);
    if (!execution) {
      return res.status(404).json({ message: 'Execution not found' });
    }
    res.json(execution);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/executions/:id/stop', async (req, res) => {
  try {
    const execution = await Execution.findByIdAndUpdate(
      req.params.id,
      { status: 'stopped' },
      { new: true }
    );
    res.json(execution);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
