const eventBroker = require("./eventBroker");
const { updateDocumentStatus } = require("./documentStatusService");
const pool = require("../config/database");

class VectorStorage {
  constructor() {
    // In-memory Vector Index: Array of { chunkId, content, embedding, metadata }
    this.index = [];
    this.initialized = false;
    this.initPromise = this.rehydrateFromDatabase().then(() => {
      this.initialized = true;
      this.registerConsumers();
      console.log(
        `[VectorStorage] 💾 Rehydrated ${this.index.length} vectors from database.`,
      );
    });
  }

  /**
   * Load all persisted vectors from the database on startup.
   * This ensures the vector index survives server restarts.
   */
  async rehydrateFromDatabase() {
    try {
      const tableExists = await pool.query(
        "SELECT to_regclass('public.document_chunks') AS table_name",
      );
      if (!tableExists.rows[0]?.table_name) {
        console.log(
          "[VectorStorage] ℹ️  document_chunks table does not exist yet. Skipping rehydration.",
        );
        return;
      }

      const result = await pool.query(
        "SELECT chunk_id, document_id, project_id, chunk_index, content, embedding, metadata FROM document_chunks",
      );

      for (const row of result.rows) {
        if (!row.embedding || row.embedding.length === 0) continue;

        this.index.push({
          chunkId: row.chunk_id,
          content: row.content,
          index: row.chunk_index,
          embedding: row.embedding,
          metadata: {
            ...row.metadata,
            documentId: row.document_id,
            projectId: row.project_id,
          },
        });
      }

      console.log(
        `[VectorStorage] 📚 Loaded ${this.index.length} vector chunks from database.`,
      );

      // Detect orphaned documents: marked as indexed but have no persisted vectors.
      // This can happen after migrating from the old in-memory-only system.
      const orphaned = await pool.query(
        `SELECT id, project_id, title, content
         FROM documents
         WHERE (embedding_status = 'indexed' OR indexed = TRUE)
           AND id NOT IN (
             SELECT document_id::uuid FROM document_chunks WHERE document_id IS NOT NULL
           )`,
      );

      if (orphaned.rows.length > 0) {
        console.log(
          `[VectorStorage] 🔄 Found ${orphaned.rows.length} orphaned indexed documents without persisted vectors. Re-indexing...`,
        );

        for (const doc of orphaned.rows) {
          if (!doc.content) {
            console.log(
              `[VectorStorage] ⏭️  Skipping orphaned document "${doc.title}" (${doc.id}) — no content available.`,
            );
            continue;
          }

          console.log(
            `[VectorStorage] 🔄 Re-indexing orphaned document "${doc.title}" (${doc.id})...`,
          );

          // Reset embedding status so the pipeline reprocesses it
          await pool.query(
            `UPDATE documents SET embedding_status = 'pending', indexed = FALSE WHERE id = $1`,
            [doc.id],
          );

          // Re-publish through the full ingestion pipeline (chunking → embedding → storage)
          eventBroker.publish("document.created", {
            documentId: doc.id,
            projectId: doc.project_id,
            title: doc.title,
            content: doc.content,
            metadata: {
              source: "startup_reindex",
              fileType: "txt",
              title: doc.title,
              projectId: doc.project_id,
              documentId: doc.id,
            },
          });
        }

        console.log(
          `[VectorStorage] ✅ Queued ${orphaned.rows.length} orphaned documents for re-indexing.`,
        );
      }
    } catch (err) {
      console.error(
        "[VectorStorage] ❌ Failed to rehydrate from database:",
        err.message,
      );
    }
  }

  registerConsumers() {
    eventBroker.subscribe(
      "document.embeddings.ready",
      "VectorStorage",
      async (payload) => {
        const { documentId, projectId, title, vectors } = payload;

        console.log(
          `[VectorStorage] 📥 Indexing ${vectors.length} vectors for document: "${title}"`,
        );

        try {
          const document = await pool.query(
            "SELECT id FROM documents WHERE id = $1 AND project_id = $2",
            [documentId, projectId],
          );

          if (!document.rows.length) {
            console.log(
              `[VectorStorage] Skipping deleted document: "${title}" (${documentId})`,
            );
            this.removeDocument(documentId);
            return;
          }

          // Build array of new chunks
          const newChunks = [];
          for (const vec of vectors) {
            newChunks.push({
              chunkId: vec.chunkId,
              content: vec.content,
              index: vec.index,
              embedding: vec.embedding,
              metadata: vec.metadata,
            });
          }

          // Remove existing chunks for this document, then add new ones
          this.index = this.index
            .filter((item) => item.metadata.documentId !== documentId)
            .concat(newChunks);

          // Persist vectors to the database (async, fire-and-forget for performance)
          this.persistVectors(documentId, projectId, newChunks).catch((err) =>
            console.error(
              "[VectorStorage] ❌ Failed to persist vectors to database:",
              err,
            ),
          );

          console.log(
            `[VectorStorage] 💾 Successfully indexed "${title}". Total vectors in index: ${this.index.length}`,
          );

          await updateDocumentStatus({
            documentId,
            projectId,
            title,
            status: "indexed",
            progress: 100,
            metadata: { chunkCount: vectors.length },
          });

          // Publish indexed completed event
          eventBroker.publish("document.indexed", {
            documentId,
            projectId,
            title,
            chunkCount: vectors.length,
          });
        } catch (err) {
          // Wrap updateDocumentStatus in try/catch to preserve original error context
          try {
            await updateDocumentStatus({
              documentId,
              projectId,
              title,
              status: "failed",
              progress: null,
              error: err.message,
            });
          } catch (statusErr) {
            err.updateStatusError = statusErr;
          }
          throw err;
        }
      },
    );
  }

  /**
   * Persist vectors to the document_chunks table.
   * Uses UPSERT to handle re-indexing of existing documents.
   */
  async persistVectors(documentId, projectId, vectors) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Delete old chunks for this document (for re-indexing scenarios)
      await client.query("DELETE FROM document_chunks WHERE document_id = $1", [
        documentId,
      ]);

      // Insert new chunks
      if (vectors.length > 0) {
        const values = [];
        const params = [];
        let paramIdx = 1;

        for (const vec of vectors) {
          const metadata = {
            ...vec.metadata,
            title: vec.metadata.title || null,
            documentId: documentId,
            projectId: projectId,
          };

          values.push(
            `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}::double precision[], $${paramIdx + 6}::jsonb)`,
          );
          params.push(
            vec.chunkId,
            documentId,
            projectId,
            vec.index,
            vec.content,
            `{${vec.embedding.join(",")}}`,
            JSON.stringify(metadata),
          );
          paramIdx += 7;
        }

        await client.query(
          `INSERT INTO document_chunks (chunk_id, document_id, project_id, chunk_index, content, embedding, metadata)
           VALUES ${values.join(", ")}`,
          params,
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Waits for the index to be rehydrated from the database before allowing queries.
   */
  async waitForReady() {
    await this.initPromise;
  }

  /**
   * Performs a Cosine Similarity search over the indexed vectors.
   * @param {number[]} queryVector The 1536-dimensional query embedding.
   * @param {string} projectId The project context.
   * @param {number} limit Number of top matching chunks to return.
   */
  async search(queryVector, projectId, limit = 3) {
    // Ensure rehydration is complete before searching
    await this.waitForReady();

    console.log(
      `[VectorStorage] 🔍 Performing vector semantic search in Project: ${projectId}`,
    );

    // Filter index by projectId (standard multitenancy metadata filtering)
    const filteredIndex = this.index.filter(
      (item) => item.metadata.projectId === projectId,
    );

    if (filteredIndex.length === 0) {
      return [];
    }

    // Calculate Cosine Similarity (Since embeddings are L2 normalized, dot product = cosine similarity)
    const scoredChunks = filteredIndex.map((item) => {
      let score = 0;
      const dim = Math.min(item.embedding.length, queryVector.length);

      for (let i = 0; i < dim; i++) {
        score += item.embedding[i] * queryVector[i];
      }

      return {
        chunkId: item.chunkId,
        content: item.content,
        index: item.index,
        metadata: item.metadata,
        similarity: parseFloat(score.toFixed(4)),
      };
    });

    // Sort by descending similarity and take the top K
    const hits = scoredChunks
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    console.log(
      `[VectorStorage] 🎯 Vector Search finished. Hits returned: ${hits.length} (Max similarity: ${hits[0]?.similarity || 0})`,
    );
    return hits;
  }

  /**
   * Helper to retrieve all indexed documents summary.
   */
  getIndexSummary() {
    const summary = {};
    for (const item of this.index) {
      const docId = item.metadata.documentId;
      if (!summary[docId]) {
        summary[docId] = {
          title: item.metadata.title,
          projectId: item.metadata.projectId,
          chunkCount: 0,
        };
      }
      summary[docId].chunkCount++;
    }
    return Object.values(summary);
  }

  removeDocument(documentId) {
    const beforeCount = this.index.length;
    this.index = this.index.filter(
      (item) => item.metadata.documentId !== documentId,
    );

    // Also remove from database (fire and forget)
    pool
      .query("DELETE FROM document_chunks WHERE document_id = $1", [documentId])
      .catch((err) =>
        console.error(
          "[VectorStorage] ❌ Failed to remove document chunks from database:",
          err,
        ),
      );

    return beforeCount - this.index.length;
  }
}

// NOTE: For pgvector deployment in PostgreSQL, the equivalent schema migration looks like:
//
// CREATE EXTENSION IF NOT EXISTS vector;
// CREATE TABLE IF NOT EXISTS document_chunks (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   chunk_id VARCHAR(255) NOT NULL,
//   document_id VARCHAR(255) NOT NULL,
//   project_id UUID NOT NULL,
//   chunk_index INT NOT NULL,
//   content TEXT NOT NULL,
//   embedding DOUBLE PRECISION[],
//   metadata JSONB,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );
// CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);

const vectorStorageInstance = new VectorStorage();
module.exports = vectorStorageInstance;
