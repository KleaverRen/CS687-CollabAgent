const express = require('express');
const multer = require('multer');
const { param, query, validationResult } = require('express-validator');
const pool = require('../config/database');
const eventBroker = require('../services/eventBroker');
const { authenticate } = require('../middleware/auth');
const { extractText, getFileType } = require('../services/fileExtractionService');
const { updateDocumentStatus } = require('../services/documentStatusService');
const { canReadProject, canWriteProject } = require('../services/projectAccess');

// Boot background RAG consumers for the document.created event published here.
require('../services/documentService');
require('../services/embeddingService');
require('../services/vectorStorage');

const router = express.Router({ mergeParams: true });
const maxUploadSizeBytes = Number(process.env.DOCUMENT_UPLOAD_MAX_BYTES || 20 * 1024 * 1024);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadSizeBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!getFileType(file)) {
      return cb(new UnsupportedFileTypeError());
    }
    cb(null, true);
  },
});

class UnsupportedFileTypeError extends Error {
  constructor() {
    super('Unsupported file type. Upload a PDF, DOCX, or TXT file.');
    this.statusCode = 415;
  }
}

router.use(authenticate);

function sendValidationErrors(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ errors: errors.array() });
  return true;
}

async function requireProjectAccess(req, res, next) {
  if (sendValidationErrors(req, res)) return undefined;

  try {
    if (!(await canReadProject(req.user, req.params.id))) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

async function requireProjectWriteAccess(req, res, next) {
  if (sendValidationErrors(req, res)) return undefined;

  try {
    if (!(await canWriteProject(req.user, req.params.id))) {
      return res.status(404).json({ error: 'Project not found or unauthorized' });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

function parseMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return {};
  return metadata;
}

function mapDocument(row) {
  const metadata = parseMetadata(row.metadata);
  return {
    id: row.id,
    projectId: row.project_id,
    uploadedBy: row.uploaded_by,
    title: row.title,
    fileName: metadata.originalName || row.title,
    fileType: row.file_type,
    fileSizeBytes: row.file_size_bytes ? Number(row.file_size_bytes) : 0,
    indexed: row.indexed,
    embeddingStatus: row.embedding_status,
    uploadDate: row.created_at,
    progress: metadata.progress ?? (row.indexed ? 100 : 0),
    chunkCount: metadata.chunkCount ?? 0,
    error: metadata.error || null,
  };
}

router.get(
  '/',
  [
    param('id').isUUID().withMessage('Valid project ID is required'),
    query('search').optional().trim().isLength({ max: 200 }),
    query('status').optional().trim().isLength({ max: 50 }),
    query('fileType').optional().trim().isIn(['pdf', 'docx', 'txt']),
  ],
  requireProjectAccess,
  async (req, res) => {
    if (sendValidationErrors(req, res)) return;

    const params = [req.params.id];
    const filters = [];

    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      filters.push(`(title ILIKE $${params.length} OR metadata->>'originalName' ILIKE $${params.length})`);
    }

    if (req.query.status) {
      params.push(req.query.status);
      filters.push(`embedding_status = $${params.length}`);
    }

    if (req.query.fileType) {
      params.push(req.query.fileType);
      filters.push(`file_type = $${params.length}`);
    }

    try {
      const result = await pool.query(
        `SELECT id, project_id, uploaded_by, title, file_type, file_size_bytes,
                indexed, embedding_status, metadata, created_at
         FROM documents
         WHERE project_id = $1
         ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
         ORDER BY created_at DESC`,
        params,
      );

      res.json({ documents: result.rows.map(mapDocument) });
    } catch (err) {
      console.error('[Documents] Failed to list documents:', err);
      res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
  },
);

router.get(
  '/:documentId',
  [
    param('id').isUUID().withMessage('Valid project ID is required'),
    param('documentId').isUUID().withMessage('Valid document ID is required'),
  ],
  requireProjectAccess,
  async (req, res) => {
    if (sendValidationErrors(req, res)) return;

    try {
      const result = await pool.query(
        `SELECT id, project_id, uploaded_by, title, file_type, file_size_bytes,
                indexed, embedding_status, metadata, created_at
         FROM documents
         WHERE id = $1 AND project_id = $2`,
        [req.params.documentId, req.params.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Document not found' });
      }

      return res.json({ document: mapDocument(result.rows[0]) });
    } catch (err) {
      console.error('[Documents] Failed to retrieve document:', err);
      return res.status(500).json({ error: 'Failed to retrieve document.' });
    }
  },
);

router.post(
  '/',
  [param('id').isUUID().withMessage('Valid project ID is required')],
  requireProjectWriteAccess,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) return next(err);
      return next();
    });
  },
  async (req, res) => {
    if (sendValidationErrors(req, res)) return;

    if (!req.file) {
      return res.status(400).json({ error: 'A document file is required.' });
    }

    let documentId = null;
    try {
      const title = req.body.title?.trim() || req.file.originalname;
      const detectedType = getFileType(req.file);
      const metadata = {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        progress: 5,
        source: 'file_upload',
      };

      const inserted = await pool.query(
        `INSERT INTO documents (
           project_id, uploaded_by, title, content, file_type,
           file_size_bytes, indexed, embedding_status, metadata
         )
         VALUES ($1, $2, $3, '', $4, $5, FALSE, 'extracting', $6)
         RETURNING id, project_id, title, file_type, file_size_bytes,
                   indexed, embedding_status, metadata, created_at`,
        [
          req.params.id,
          req.user.id,
          title,
          detectedType,
          req.file.size,
          JSON.stringify(metadata),
        ],
      );

      documentId = inserted.rows[0].id;
      eventBroker.publish('document.extraction.started', {
        documentId,
        projectId: req.params.id,
        title,
        fileType: detectedType,
      });

      const { text, fileType } = await extractText(req.file);
      await pool.query(
        `UPDATE documents
         SET content = $2, file_type = $3
         WHERE id = $1`,
        [documentId, text, fileType],
      );
      await updateDocumentStatus({
        documentId,
        projectId: req.params.id,
        title,
        status: 'extracted',
        progress: 25,
        metadata: { characterCount: text.length },
      });

      const eventId = eventBroker.publish('document.created', {
        documentId,
        projectId: req.params.id,
        title,
        content: text,
        metadata: {
          source: 'file_upload',
          fileType,
          originalName: req.file.originalname,
          uploadedBy: req.user.id,
          userEmail: req.user.email,
        },
      });

      const document = await pool.query(
        `SELECT id, project_id, uploaded_by, title, file_type, file_size_bytes,
                indexed, embedding_status, metadata, created_at
         FROM documents WHERE id = $1`,
        [documentId],
      );

      return res.status(202).json({
        message: 'Document upload accepted and queued for indexing.',
        document: mapDocument(document.rows[0]),
        eventId,
      });
    } catch (err) {
      console.error('[Documents] Upload failed:', err);
      if (documentId) {
        await updateDocumentStatus({
          documentId,
          projectId: req.params.id,
          status: 'failed',
          progress: 100,
          error: err.message,
        }).catch((statusErr) =>
          console.error('[Documents] Failed to mark upload as failed:', statusErr),
        );
      }

      const statusCode = err.statusCode || 500;
      return res.status(statusCode).json({
        error:
          statusCode === 500
            ? 'Failed to extract and index the uploaded document.'
            : err.message,
      });
    }
  },
);

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: `File is too large. Maximum upload size is ${Math.round(maxUploadSizeBytes / 1024 / 1024)} MB.`,
      });
    }
    return res.status(400).json({ error: err.message });
  }

  if (err instanceof UnsupportedFileTypeError || err.statusCode === 415) {
    return res.status(415).json({ error: err.message });
  }

  return next(err);
});

module.exports = router;
