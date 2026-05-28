const pool = require('../config/database');
const eventBroker = require('./eventBroker');

const terminalStatuses = new Set(['indexed', 'failed']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeProgress(progress) {
  if (typeof progress !== 'number' || Number.isNaN(progress)) return null;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

async function updateDocumentStatus({
  documentId,
  projectId,
  title,
  status,
  progress,
  metadata = {},
  error = null,
}) {
  if (!documentId) return null;

  const normalizedProgress = normalizeProgress(progress);
  if (!uuidPattern.test(documentId)) {
    eventBroker.publish('document.status.updated', {
      documentId,
      projectId,
      title,
      status,
      progress: normalizedProgress,
      error,
    });
    return null;
  }

  const metadataPatch = {
    ...metadata,
    ...(normalizedProgress !== null ? { progress: normalizedProgress } : {}),
    ...(error ? { error } : {}),
    statusUpdatedAt: new Date().toISOString(),
  };
  const indexed = status === 'indexed' ? true : terminalStatuses.has(status) ? false : null;

  const params = [documentId, status, JSON.stringify(metadataPatch)];
  const indexedSql =
    indexed === null ? '' : `, indexed = $${params.push(indexed)}`;

  const result = await pool.query(
    `UPDATE documents
     SET embedding_status = $2,
         metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
         ${indexedSql}
     WHERE id = $1
     RETURNING id, project_id, title, embedding_status, indexed, metadata`,
    params,
  );

  const document = result.rows[0] || null;
  eventBroker.publish('document.status.updated', {
    documentId,
    projectId: projectId || document?.project_id,
    title: title || document?.title,
    status,
    progress: normalizedProgress,
    error,
  });

  return document;
}

module.exports = { updateDocumentStatus };
