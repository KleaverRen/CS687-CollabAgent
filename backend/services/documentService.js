const eventBroker = require('./eventBroker');
const { updateDocumentStatus } = require('./documentStatusService');

class DocumentService {
  constructor() {
    // Initialize consumer subscription
    this.registerConsumers();
  }

  registerConsumers() {
    eventBroker.subscribe('document.created', 'DocumentService', async (payload) => {
      const { documentId, content, title, projectId, metadata } = payload;
      
      console.log(`[DocumentService] 📄 Parsing document: "${title}" (ID: ${documentId})`);

      try {
        await updateDocumentStatus({
          documentId,
          projectId,
          title,
          status: 'chunking',
          progress: 35,
        });

        // Perform text chunking
        const chunks = this.chunkText(content, {
          chunkSize: 500, // characters
          chunkOverlap: 100 // characters overlap
        });

        if (chunks.length === 0) {
          throw new Error('No text chunks were produced from this document.');
        }

        console.log(`[DocumentService] ✂️  Decomposed "${title}" into ${chunks.length} chunks.`);

        await updateDocumentStatus({
          documentId,
          projectId,
          title,
          status: 'embedding',
          progress: 55,
          metadata: { chunkCount: chunks.length },
        });

        // Publish chunk parsed event
        eventBroker.publish('document.chunks.ready', {
          documentId,
          projectId,
          title,
          chunks: chunks.map((c, idx) => ({
            chunkId: `${documentId}_chk_${idx}`,
            index: idx,
            content: c,
            searchText: `${title}\n\n${c}`,
            metadata: {
              ...metadata,
              title,
              projectId,
              documentId
            }
          }))
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
   * Splits text into paragraph/sentence-aligned chunks.
   * @param {string} text Raw text content.
   * @param {object} options Chunking configuration.
   * @returns {string[]} Array of text chunks.
   */
  chunkText(text, { chunkSize, chunkOverlap }) {
    if (!text || typeof text !== 'string') return [];
    
    const paragraphs = text
      .replace(/\r\n/g, '\n')
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const cleanText = paragraphs.join(' ');
    if (cleanText.length <= chunkSize) return [cleanText];

    const chunks = [];
    let current = '';

    const pushCurrent = () => {
      if (current.trim()) {
        chunks.push(current.trim());
        current = this.getWholeSentenceOverlap(chunks[chunks.length - 1], chunkOverlap);
      }
    };

    for (const paragraph of paragraphs) {
      const units = paragraph.length > chunkSize
        ? paragraph.split(/(?<=[.!?])\s+/).filter(Boolean)
        : [paragraph];

      for (const unit of units) {
        if (!current) {
          current = unit;
          continue;
        }

        if (`${current} ${unit}`.length > chunkSize) {
          pushCurrent();
        }

        current = current ? `${current} ${unit}` : unit;
      }
    }

    pushCurrent();

    return chunks;
  }

  getWholeSentenceOverlap(chunk, chunkOverlap) {
    if (!chunkOverlap) return '';

    const sentences = chunk.split(/(?<=[.!?])\s+/).filter(Boolean);
    const lastSentence = sentences[sentences.length - 1] || '';
    return lastSentence.length <= chunkOverlap ? lastSentence : '';
  }
}

// Create and export a single instance
const documentServiceInstance = new DocumentService();
module.exports = documentServiceInstance;
