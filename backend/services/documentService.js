const eventBroker = require('./eventBroker');

class DocumentService {
  constructor() {
    // Initialize consumer subscription
    this.registerConsumers();
  }

  registerConsumers() {
    eventBroker.subscribe('document.created', 'DocumentService', async (payload) => {
      const { documentId, content, title, projectId, metadata } = payload;
      
      console.log(`[DocumentService] 📄 Parsing document: "${title}" (ID: ${documentId})`);
      
      // Perform text chunking
      const chunks = this.chunkText(content, {
        chunkSize: 500, // characters
        chunkOverlap: 100 // characters overlap
      });

      console.log(`[DocumentService] ✂️  Decomposed "${title}" into ${chunks.length} chunks.`);

      // Publish chunk parsed event
      eventBroker.publish('document.chunks.ready', {
        documentId,
        projectId,
        title,
        chunks: chunks.map((c, idx) => ({
          chunkId: `${documentId}_chk_${idx}`,
          index: idx,
          content: c,
          metadata: {
            ...metadata,
            title,
            projectId,
            documentId
          }
        }))
      });
    });
  }

  /**
   * Splits text into overlapping chunks using a sliding window.
   * @param {string} text Raw text content.
   * @param {object} options Chunking configuration.
   * @returns {string[]} Array of text chunks.
   */
  chunkText(text, { chunkSize, chunkOverlap }) {
    if (!text || typeof text !== 'string') return [];
    
    // Normalize spaces
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (cleanText.length <= chunkSize) return [cleanText];

    const chunks = [];
    let start = 0;

    while (start < cleanText.length) {
      let end = start + chunkSize;
      
      // Attempt to align chunk boundaries with words/sentences if not at the absolute end
      if (end < cleanText.length) {
        const nextSpace = cleanText.indexOf(' ', end);
        const lastPeriod = cleanText.lastIndexOf('.', end);
        
        // Prefer splitting at sentence boundary if close
        if (lastPeriod > start + (chunkSize / 2)) {
          end = lastPeriod + 1; // Include the period
        } else if (nextSpace !== -1 && nextSpace < end + 20) {
          end = nextSpace; // Align at word boundary
        }
      }

      const chunk = cleanText.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Advance sliding window
      start = end - chunkOverlap;
      if (start >= cleanText.length || chunk.length === 0) break;
    }

    return chunks;
  }
}

// Create and export a single instance
const documentServiceInstance = new DocumentService();
module.exports = documentServiceInstance;
