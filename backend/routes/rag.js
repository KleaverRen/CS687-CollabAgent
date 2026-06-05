const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const eventBroker = require('../services/eventBroker');
const vectorStorage = require('../services/vectorStorage');
const generationService = require('../services/generationService');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { canReadProject, canWriteProject } = require('../services/projectAccess');

// Boot background microservice event consumers
require('../services/documentService');
require('../services/embeddingService');

// Note: For development/testing, authenticate can be bypassed, but we require it here for production alignment
router.use(authenticate);
router.use((req, res, next) => {
  if (req.user?.role !== 'student') {
    return res.status(403).json({ error: 'Knowledge Agent is available to students only.' });
  }
  next();
});

function serializeStreamEvent(event) {
  return {
    ...event,
    payload: eventBroker.sanitizeHistoryPayload(event.topic, event.payload),
  };
}

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
    let documentId = null;

    try {
      if (!(await canWriteProject(req.user, projectId))) {
        return res.status(404).json({ error: 'Project not found or unauthorized' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Failed to verify project access.' });
    }

    console.log(`[RAG-Router] 📥 Received ingestion request for: "${title}" in project [${projectId}]`);

    try {
      const inserted = await pool.query(
        `INSERT INTO documents (
           project_id, uploaded_by, title, content, file_type,
           file_size_bytes, indexed, embedding_status, metadata
         )
         VALUES ($1, $2, $3, $4, 'txt', $5, FALSE, 'queued', $6)
         RETURNING id`,
        [
          projectId,
          req.user.id,
          title,
          content,
          Buffer.byteLength(content, 'utf8'),
          JSON.stringify({
            ...metadata,
            progress: 5,
            source: metadata.source || 'workbench_text',
            characterCount: content.length,
          }),
        ],
      );
      documentId = inserted.rows[0].id;
    } catch (err) {
      console.error('[RAG-Router] Failed to store document before ingestion:', err);
      return res.status(500).json({ error: 'Failed to queue document for indexing.' });
    }

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
      if (!(await canReadProject(req.user, projectId))) {
        return res.status(404).json({ error: 'Project not found or unauthorized' });
      }

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
    const documents = [];
    for (const document of vectorStorage.getIndexSummary()) {
      if (await canReadProject(req.user, document.projectId)) {
        documents.push(document);
      }
    }
    res.json({
      totalVectors: documents.reduce((count, document) => count + document.chunkCount, 0),
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
router.get('/events/stream', async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required' });
  }
  if (!(await canReadProject(req.user, projectId))) {
    return res.status(404).json({ error: 'Project not found or unauthorized' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Flush headers immediately
  res.flushHeaders();

  console.log('[RAG-Router] 🔌 Client connected to live events SSE stream.');

  // Push existing event history to let the client catch up
  const history = eventBroker
    .getHistory()
    .filter((evt) => evt?.payload?.projectId === projectId);
  history.forEach(evt => {
    res.write(`data: ${JSON.stringify(serializeStreamEvent(evt))}\n\n`);
  });

  // Handler to stream new events dynamically
  const eventListener = (event) => {
    if (event?.payload?.projectId !== projectId) return;
    res.write(`data: ${JSON.stringify(serializeStreamEvent(event))}\n\n`);
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
