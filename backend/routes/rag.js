const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const eventBroker = require('../services/eventBroker');
const vectorStorage = require('../services/vectorStorage');
const generationService = require('../services/generationService');
const { authenticate } = require('../middleware/auth');

// Boot background microservice event consumers
require('../services/documentService');
require('../services/embeddingService');

// Note: For development/testing, authenticate can be bypassed, but we require it here for production alignment
router.use(authenticate);

/**
 * POST /api/rag/ingest
 * Ingests a new document asynchronously by publishing a "document.created" event.
 */
router.post(
  '/ingest',
  [
    body('title').trim().notEmpty().withMessage('Document title is required'),
    body('content').trim().notEmpty().withMessage('Document content is required'),
    body('projectId').isUUID().withMessage('Valid project ID is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, content, projectId, metadata = {} } = req.body;
    const documentId = `doc_${Math.random().toString(36).substring(2, 11)}`;

    console.log(`[RAG-Router] 📥 Received ingestion request for: "${title}" in project [${projectId}]`);

    // 1. Kick off the asynchronous ingestion pipeline by publishing the created event
    const eventId = eventBroker.publish('document.created', {
      documentId,
      projectId,
      title,
      content,
      metadata: {
        ...metadata,
        uploadedBy: req.user.id,
        userEmail: req.user.email
      }
    });

    // 2. Return a 202 Accepted status immediately, showing the client the job has been queued.
    res.status(202).json({
      message: 'Document ingestion accepted and queued.',
      documentId,
      eventId,
      status: 'processing',
      monitorUrl: `/api/rag/events/stream`
    });
  }
);

/**
 * POST /api/rag/query
 * Performs synchronous retrieval-augmented generation.
 */
router.post(
  '/query',
  [
    body('query').trim().notEmpty().withMessage('Query string is required'),
    body('projectId').isUUID().withMessage('Valid project ID is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { query, projectId, limit = 3, provider = null } = req.body;

    try {
      // Execute retrieval-augmented synthesis
      const response = await generationService.generateAnswer(query, projectId, { limit, provider });
      res.json(response);
    } catch (err) {
      console.error('[RAG-Router] Query processing failed:', err);
      res.status(500).json({ error: 'Failed to process RAG query.' });
    }
  }
);

/**
 * GET /api/rag/summary
 * Provides statistical indexing metrics of the active Vector Storage Database.
 */
router.get('/summary', async (req, res) => {
  try {
    const documents = vectorStorage.getIndexSummary();
    res.json({
      totalVectors: vectorStorage.index.length,
      indexedDocumentsCount: documents.length,
      documents
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve index stats.' });
  }
});

/**
 * GET /api/rag/events/stream
 * Real-time Server-Sent Events (SSE) endpoint to monitor background microservice events.
 * The client can establish a listener to watch state transition events firing in real time!
 */
router.get('/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Flush headers immediately
  res.flushHeaders();

  console.log('[RAG-Router] 🔌 Client connected to live events SSE stream.');

  // Push existing event history to let the client catch up
  const history = eventBroker.getHistory();
  history.forEach(evt => {
    res.write(`data: ${JSON.stringify(evt)}\n\n`);
  });

  // Handler to stream new events dynamically
  const eventListener = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Subscribe to all event dispatches
  eventBroker.on('*', eventListener);

  // Clean up subscription when client disconnects
  req.on('close', () => {
    console.log('[RAG-Router] ❌ Client disconnected from live events SSE stream.');
    eventBroker.removeListener('*', eventListener);
    res.end();
  });
});

module.exports = router;
