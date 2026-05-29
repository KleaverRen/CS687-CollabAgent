const eventBroker = require('./eventBroker');
const { updateDocumentStatus } = require('./documentStatusService');

class EmbeddingService {
  constructor() {
    this.initializeLocalEmbeddings();
    this.registerConsumers();
  }

  initializeLocalEmbeddings() {
    console.log('[EmbeddingService] ℹ️  Using deterministic word-hash vector projection for local offline similarity search.');
  }

  registerConsumers() {
    eventBroker.subscribe('document.chunks.ready', 'EmbeddingService', async (payload) => {
      const { documentId, projectId, title, chunks } = payload;
      
      console.log(`[EmbeddingService] 🧠 Generating embeddings for ${chunks.length} chunks of "${title}"`);

      try {
        await updateDocumentStatus({
          documentId,
          projectId,
          title,
          status: 'embedding',
          progress: 65,
        });

        const vectors = [];
        for (const chunk of chunks) {
          const embedding = await this.getEmbedding(chunk.searchText || chunk.content);
          vectors.push({
            chunkId: chunk.chunkId,
            content: chunk.content,
            index: chunk.index,
            embedding,
            metadata: {
              ...chunk.metadata,
              searchText: chunk.searchText || chunk.content
            }
          });
        }

        console.log(`[EmbeddingService] ✅ Vector embeddings generated for "${title}".`);

        await updateDocumentStatus({
          documentId,
          projectId,
          title,
          status: 'indexing',
          progress: 85,
          metadata: { chunkCount: vectors.length },
        });
        
        // Publish embeddings ready event
        eventBroker.publish('document.embeddings.ready', {
          documentId,
          projectId,
          title,
          vectors
        });
      } catch (err) {
        await updateDocumentStatus({
          documentId,
          projectId,
          title,
          status: 'failed',
          progress: 100,
          error: err.message,
        });
        throw err;
      }
    });
  }

  /**
   * Generates a deterministic 1536-dimensional embedding array.
   * @param {string} text The string to embed.
   */
  async getEmbedding(text) {
    return this.generateDeterministicVector(text);
  }

  /**
   * Helper that projects text into a normalized 1536-dimensional space.
   * Words mapped to the same index add to the magnitude, creating a semantic overlap
   * proxy where overlapping words naturally yield a higher cosine similarity.
   */
  generateDeterministicVector(text) {
    const dimensions = 1536;
    const vector = new Array(dimensions).fill(0);
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2); // filter out tiny stop words

    if (words.length === 0) {
      // Seed with character-level details if no words exist
      words.push(text.length.toString());
    }

    // Distribute word hashes across dimensions
    for (const word of words) {
      // Simple hash code
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash << 5) - hash + word.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }

      // Project into multiple coordinates (e.g., 3 dimensions per word to increase feature distribution)
      for (let j = 0; j < 3; j++) {
        const idx = Math.abs((hash + j * 997)) % dimensions;
        // Directional push based on hash parity
        const val = ((hash >> j) & 1) ? 1.0 : -1.0;
        vector[idx] += val;
      }
    }

    // Compute magnitude for L2 Normalization
    let sumSquares = 0;
    for (let i = 0; i < dimensions; i++) {
      sumSquares += vector[i] * vector[i];
    }
    const magnitude = Math.sqrt(sumSquares) || 1;

    // Normalize vector (so dot product equals cosine similarity)
    return vector.map(v => parseFloat((v / magnitude).toFixed(6)));
  }
}

const embeddingServiceInstance = new EmbeddingService();
module.exports = embeddingServiceInstance;
