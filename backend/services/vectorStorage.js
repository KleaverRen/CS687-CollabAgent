const eventBroker = require("./eventBroker");
const { updateDocumentStatus } = require("./documentStatusService");

class VectorStorage {
  constructor() {
    // In-memory Vector Index: Array of { chunkId, content, embedding, metadata }
    this.index = [];
    this.registerConsumers();
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
          // Build temporary array atomically: create new chunks first, then replace old entries
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

          // De-duplicate: Remove existing chunks for this document, then add new ones
          // This is now atomic: if the loop above fails, this.index remains unchanged
          this.index = this.index
            .filter((item) => item.metadata.documentId !== documentId)
            .concat(newChunks);

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
              progress: null, // Use null to clearly indicate failure rather than completion
              error: err.message,
            });
          } catch (statusErr) {
            // Attach secondary error and re-throw original with context preserved
            err.updateStatusError = statusErr;
          }
          throw err;
        }
      },
    );
  }

  /**
   * Performs a Cosine Similarity search over the indexed vectors.
   * @param {number[]} queryVector The 1536-dimensional query embedding.
   * @param {string} projectId The project context.
   * @param {number} limit Number of top matching chunks to return.
   */
  async search(queryVector, projectId, limit = 3) {
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
}

// NOTE: For pgvector deployment in PostgreSQL, the equivalent schema migration looks like:
//
// CREATE EXTENSION IF NOT EXISTS vector;
// CREATE TABLE IF NOT EXISTS document_chunks (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   document_id VARCHAR(255) NOT NULL,
//   project_id UUID NOT NULL,
//   chunk_index INT NOT NULL,
//   content TEXT NOT NULL,
//   embedding vector(1536),
//   metadata JSONB,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );
// CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);

const vectorStorageInstance = new VectorStorage();
module.exports = vectorStorageInstance;
