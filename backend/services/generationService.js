const embeddingService = require("./embeddingService");
const vectorStorage = require("./vectorStorage");
const pool = require("../config/database");

class GenerationService {
  constructor() {
    this.ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";
    this.ollamaModel = process.env.OLLAMA_MODEL || "llama3.2";
    this.groqClient = null;
    this.geminiClient = null;
    this.mistralClient = null;
    this.initializeLLMClients();
  }

  initializeLLMClients() {
    if (process.env.GROQ_API_KEY) {
      try {
        const { ChatGroq } = require("@langchain/groq");
        this.groqClient = new ChatGroq({
          apiKey: process.env.GROQ_API_KEY,
          modelName: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          temperature: 0.1,
        });
        console.log(
          "[GenerationService] 🤖 Groq (LangChain) initialized for real generation.",
        );
      } catch (err) {
        console.warn(
          "[GenerationService] ⚠️ Failed to load @langchain/groq package.",
        );
      }
    }
    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenAI } = require("@google/genai");
        this.geminiClient = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
        });
        this.geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";
        console.log(
          "[GenerationService] 🤖 Google Gemini GenAI initialized for real generation.",
        );
      } catch (err) {
        console.warn(
          "[GenerationService] ⚠️ Failed to load @google/genai package.",
        );
      }
    }
    if (process.env.MISTRAL_API_KEY) {
      try {
        const { Mistral } = require("@mistralai/mistralai");
        this.mistralClient = new Mistral({
          apiKey: process.env.MISTRAL_API_KEY,
        });
        console.log("[GenerationService] 🤖 Mistral AI initialized.");
      } catch (err) {
        console.warn(
          "[GenerationService] ⚠️ Mistral package not installed. Run: npm install @mistralai/mistralai",
        );
      }
    }
    console.log(
      `[GenerationService] 🤖 Ollama configured as default local model (${this.ollamaModel}) at ${this.ollamaHost}.`,
    );
  }

  async generateText(
    systemPrompt,
    userPrompt,
    fallbackText = "",
    preferredProvider = null,
  ) {
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // If a specific provider is requested, try it first
    if (preferredProvider === "groq" && this.groqClient) {
      try {
        return await this.queryGroqMessages(messages);
      } catch (e) {
        console.error(e);
      }
    }
    if (preferredProvider === "gemini" && this.geminiClient) {
      try {
        return await this.queryGeminiMessages(messages);
      } catch (e) {
        console.error(e);
      }
    }
    if (preferredProvider === "mistral" && this.mistralClient) {
      try {
        return await this.queryMistralMessages(messages);
      } catch (e) {
        console.error(e);
      }
    }
    if (preferredProvider === "ollama") {
      try {
        return await this.queryOllamaMessages(messages);
      } catch (e) {
        console.error(e);
      }
    }

    try {
      return await this.queryOllamaMessages(messages);
    } catch (err) {
      console.warn(
        "[GenerationService] ⚠️ Ollama text generation unavailable, falling back:",
        err.message,
      );
    }

    if (this.groqClient) {
      try {
        return await this.queryGroqMessages(messages);
      } catch (err) {
        console.error("[GenerationService] Groq text generation failed:", err);
      }
    }

    if (this.geminiClient) {
      try {
        return await this.queryGeminiMessages(messages);
      } catch (err) {
        console.error(
          "[GenerationService] Gemini text generation failed:",
          err,
        );
      }
    }

    return fallbackText;
  }

  async generateJson(
    systemPrompt,
    userPrompt,
    fallbackValue = null,
    preferredProvider = null,
  ) {
    const responseText = await this.generateText(
      systemPrompt,
      userPrompt,
      "",
      preferredProvider,
    );
    if (!responseText) return fallbackValue;

    try {
      return JSON.parse(this.extractJsonPayload(responseText));
    } catch (err) {
      console.error(
        "[GenerationService] Failed to parse JSON model response:",
        responseText,
      );
      return fallbackValue;
    }
  }

  extractJsonPayload(responseText) {
    const stripped = responseText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const firstObject = stripped.indexOf("{");
    const firstArray = stripped.indexOf("[");
    const startsWithArray =
      firstArray !== -1 && (firstObject === -1 || firstArray < firstObject);
    const start = startsWithArray ? firstArray : firstObject;

    if (start !== -1) {
      const end = this.findJsonPayloadEnd(stripped, start);
      if (end !== -1) return stripped.slice(start, end + 1);
    }

    return stripped;
  }

  findJsonPayloadEnd(text, start) {
    const opening = text[start];
    const closing = opening === "{" ? "}" : "]";
    const stack = [closing];
    let inString = false;
    let escaped = false;

    for (let i = start + 1; i < text.length; i++) {
      const char = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === "{") {
        stack.push("}");
      } else if (char === "[") {
        stack.push("]");
      } else if (char === stack[stack.length - 1]) {
        stack.pop();
        if (stack.length === 0) return i;
      }
    }

    return -1;
  }

  /**
   * Orchestrates the complete RAG Query pipeline:
   * 1. Vectorize Query -> 2. Query Vector DB -> 3. Augment Prompt -> 4. Synthesize Answer
   */
  async generateAnswer(
    query,
    projectId,
    options = { limit: 3, provider: null },
  ) {
    console.log(
      `[GenerationService] 🚀 Starting RAG Query pipeline for: "${query}"`,
    );

    // Step 1: Vectorize user query
    const queryVector = await embeddingService.getEmbedding(query);
    const queryTerms = this.extractSearchTerms(query);

    // Step 2: Retrieve relevant context chunks via vector database
    let contextHits = await vectorStorage.search(
      queryVector,
      projectId,
      options.limit,
    );

    if (this.shouldUseDocumentFallback(contextHits, queryTerms)) {
      const databaseHits = await this.findDocumentContextFromDatabase(
        query,
        projectId,
        options.limit,
        queryTerms,
      );
      if (databaseHits.length > 0) {
        contextHits = databaseHits;
      }
    }

    if (contextHits.length === 0) {
      return {
        answer:
          "I couldn't find any relevant document context in this project to answer your question. Please ensure you have ingested the relevant project documents first.",
        sources: [],
      };
    }

    const directFocusAnswer = this.answerFocusQuestion(
      query.toLowerCase(),
      contextHits,
    );
    if (directFocusAnswer) {
      return this.formatRagResponse(
        directFocusAnswer,
        await this.hydrateSourceFullText(contextHits),
      );
    }

    // Step 3: Construct prompt and generate answer
    let answerText = "";

    // Try preferred provider for RAG if specified
    if (options.provider === "groq" && this.groqClient) {
      answerText = await this.queryGroq(query, contextHits);
    } else if (options.provider === "gemini" && this.geminiClient) {
      answerText = await this.queryGemini(query, contextHits);
    } else if (options.provider === "ollama") {
      try {
        answerText = await this.queryOllama(query, contextHits);
      } catch (e) {
        console.warn(e);
      }
    }

    if (answerText) {
      return this.formatRagResponse(
        answerText,
        await this.hydrateSourceFullText(contextHits),
      );
    }

    // Attempt local generation first, then fall back to configured remote providers.
    try {
      answerText = await this.queryOllama(query, contextHits);
    } catch (err) {
      console.warn(
        "[GenerationService] ⚠️ Ollama unavailable, falling back to other providers:",
        err.message,
      );
    }

    if (!answerText) {
      if (this.groqClient) {
        answerText = await this.queryGroq(query, contextHits);
      } else if (this.geminiClient) {
        answerText = await this.queryGemini(query, contextHits);
      }
    }

    if (!answerText) {
      // Step 4: Local Semantic Reasoning Engine (No API Key Fallback)
      answerText = this.localReasoningEngine(query, contextHits);
    }

    return this.formatRagResponse(
      answerText,
      await this.hydrateSourceFullText(contextHits),
    );
  }

  shouldUseDocumentFallback(contextHits, queryTerms) {
    if (contextHits.length === 0) return true;
    if (queryTerms.length === 0) return false;

    return !contextHits.some((hit) => {
      const searchable = `${hit.metadata?.title || ""}\n${hit.content || ""}`.toLowerCase();
      return queryTerms.some((term) => searchable.includes(term));
    });
  }

  async findDocumentContextFromDatabase(query, projectId, limit = 3, queryTerms = null) {
    queryTerms = queryTerms || this.extractSearchTerms(query);
    if (queryTerms.length === 0) return [];

    try {
      const result = await pool.query(
        `SELECT id, title, content, embedding_status, metadata, created_at
         FROM documents
         WHERE project_id = $1
           AND content IS NOT NULL
           AND char_length(trim(content)) > 0
           AND COALESCE(embedding_status, 'pending') <> 'failed'
         ORDER BY created_at DESC
         LIMIT 25`,
        [projectId],
      );

      return result.rows
        .map((row) => this.scoreDocumentRow(row, queryTerms))
        .filter((hit) => hit.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((hit, index) => ({
          chunkId: `${hit.documentId}_db_${index}`,
          content: hit.content,
          index,
          metadata: {
            ...(hit.metadata || {}),
            title: hit.title,
            documentId: hit.documentId,
            projectId,
            embeddingStatus: hit.embeddingStatus,
            source: "document_database",
            fullText: hit.content,
          },
          similarity: Math.min(0.99, parseFloat((hit.score / queryTerms.length).toFixed(4))),
        }));
    } catch (err) {
      console.error("[GenerationService] Database document fallback failed:", err);
      return [];
    }
  }

  async hydrateSourceFullText(contextHits) {
    const missingDocumentIds = [
      ...new Set(
        contextHits
          .filter((hit) => !hit.metadata?.fullText && hit.metadata?.documentId)
          .map((hit) => hit.metadata.documentId),
      ),
    ];

    if (missingDocumentIds.length === 0) return contextHits;

    try {
      const result = await pool.query(
        `SELECT id, content
         FROM documents
         WHERE id = ANY($1::uuid[])
           AND content IS NOT NULL
           AND char_length(trim(content)) > 0`,
        [missingDocumentIds],
      );
      const contentById = new Map(result.rows.map((row) => [row.id, row.content]));

      return contextHits.map((hit) => ({
        ...hit,
        metadata: {
          ...hit.metadata,
          fullText: contentById.get(hit.metadata.documentId) || hit.metadata.fullText,
        },
      }));
    } catch (err) {
      console.error("[GenerationService] Failed to hydrate source full text:", err);
      return contextHits;
    }
  }

  extractSearchTerms(text) {
    const stopWords = new Set([
      "what",
      "which",
      "when",
      "where",
      "should",
      "track",
      "focused",
      "focus",
      "about",
      "with",
      "from",
      "this",
      "that",
      "have",
      "does",
      "into",
      "and",
      "the",
      "for",
      "are",
      "our",
      "you",
    ]);

    return [
      ...new Set(
        String(text || "")
          .toLowerCase()
          .replace(/[^\w\s]/g, " ")
          .split(/\s+/)
          .map((term) => term.trim())
          .filter((term) => term.length > 2 && !stopWords.has(term)),
      ),
    ];
  }

  scoreDocumentRow(row, queryTerms) {
    const title = String(row.title || "");
    const content = String(row.content || "");
    const searchable = `${title}\n${content}`.toLowerCase();
    let score = 0;

    for (const term of queryTerms) {
      if (title.toLowerCase().includes(term)) score += 3;
      if (searchable.includes(term)) score += 1;
    }

    const phaseMatch = queryTerms.find((term) => /^\d+$/.test(term));
    if (phaseMatch && searchable.includes(`phase ${phaseMatch}`)) score += 4;

    return {
      documentId: row.id,
      title,
      content,
      metadata: row.metadata,
      embeddingStatus: row.embedding_status,
      score,
    };
  }

  formatRagResponse(answerText, contextHits) {
    const sourcesByDocument = new Map();

    for (const hit of contextHits) {
      const documentId = hit.metadata.documentId || hit.chunkId;
      const existing = sourcesByDocument.get(documentId);
      const snippet = this.buildSnippet(hit.content);

      if (!existing) {
        sourcesByDocument.set(documentId, {
          chunkId: hit.chunkId,
          documentTitle: hit.metadata.title,
          documentId,
          similarity: hit.similarity,
          snippet,
          fullText: hit.metadata.fullText || hit.content,
        });
        continue;
      }

      if (hit.similarity > existing.similarity) {
        existing.chunkId = hit.chunkId;
        existing.similarity = hit.similarity;
      }

      if (!existing.snippet.includes(snippet)) {
        existing.snippet = `${existing.snippet}\n\n${snippet}`;
      }
      existing.fullText = existing.fullText || hit.metadata.fullText || hit.content;
    }

    return {
      answer: answerText,
      sources: Array.from(sourcesByDocument.values()),
    };
  }

  buildSnippet(content, maxLength = 180) {
    const normalized = String(content || "")
      .replace(/\s+/g, " ")
      .trim();
    if (normalized.length <= maxLength) return normalized;

    const end = normalized.lastIndexOf(" ", maxLength);
    return `${normalized.slice(0, end > maxLength * 0.6 ? end : maxLength).trim()}...`;
  }

  /**
   * Smart local reasoner that analyzes the query and retrieved context chunks
   * to build a coherent, highly targeted markdown answer with source citations.
   */
  localReasoningEngine(query, chunks) {
    const cleanQuery = query.toLowerCase();
    const focusAnswer = this.answerFocusQuestion(cleanQuery, chunks);
    if (focusAnswer) return focusAnswer;

    const sentences = [];

    // Extract sentences from matching chunks that share vocabulary/concepts with the query
    const queryWords = cleanQuery
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3);

    for (const chunk of chunks) {
      const docSentences = [
        chunk.metadata.title,
        ...chunk.content.split(/(?<=[.!?])\s+/),
      ];
      for (const sentence of docSentences) {
        const cleanSentence = sentence.toLowerCase();
        // Check for matching keywords
        const score = queryWords.reduce(
          (acc, word) => acc + (cleanSentence.includes(word) ? 1 : 0),
          0,
        );

        if (score > 0) {
          sentences.push({
            text: sentence.trim(),
            docTitle: chunk.metadata.title,
            score,
          });
        }
      }
    }

    // Sort matching sentences by relevance score
    sentences.sort((a, b) => b.score - a.score);

    // Build synthesized response
    let md = `### 🤖 Synthesized Answer (Local Semantic RAG Engine)\n\n`;

    if (sentences.length > 0) {
      md += `Based on the project documentation, here is what I found:\n\n`;
      // Take top 3 relevant sentences and present them as a unified paragraph
      const selectedSentences = sentences.slice(0, 4);

      selectedSentences.forEach((s, idx) => {
        md += `*   **${s.text}** *(Source: _${s.docTitle}_)*\n`;
      });

      md += `\n\n> [!TIP]\n`;
      md += `> This response was synthesized by mapping the key terms of your query (*${queryWords.slice(0, 5).join(", ")}*) directly to semantic chunks in the indexed database.\n`;
    } else {
      md += `I located relevant documentation in **${chunks[0].metadata.title}**, but no individual sentences directly address the key words in your query.\n\n`;
      md += `Here is the most closely related documentation segment:\n\n`;
      md += `> "${chunks[0].content.slice(0, 300)}..."\n\n`;
    }

    // Add source catalog
    md += `\n\n#### 📚 Referenced Context Blocks:\n`;
    chunks.forEach((chunk, index) => {
      md += `${index + 1}.  **${chunk.metadata.title}** (Relevance Match: \`${Math.round(chunk.similarity * 100)}%\`)\n`;
      md += `    *Snippet: "${chunk.content.slice(0, 160)}..."*\n`;
    });

    return md;
  }

  answerFocusQuestion(cleanQuery, chunks) {
    if (!/\bfocus(?:es|ed)?\b|\bfocus on\b|\babout\b/.test(cleanQuery))
      return null;

    const phaseMatch = cleanQuery.match(/\bphase\s*(\d+)\b/);
    if (!phaseMatch) return null;

    const phaseLabel = `phase ${phaseMatch[1]}`;
    const matchingChunks = chunks
      .filter((chunk) =>
        String(chunk.metadata.title || "")
          .toLowerCase()
          .includes(phaseLabel),
      )
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    if (matchingChunks.length === 0) return null;

    const title = matchingChunks[0].metadata.title;
    const titleFocus = title.includes(":")
      ? title.split(":").slice(1).join(":").trim()
      : title;
    const content = matchingChunks.map((chunk) => chunk.content).join(" ");
    const normalizedContent = content.replace(/\s+/g, " ").trim();
    const uniqueSentences = [
      ...new Set(normalizedContent.split(/(?<=[.!?])\s+/).filter(Boolean)),
    ];
    const supportingSentences = uniqueSentences
      .map((sentence, index) => ({
        sentence,
        index,
        score:
          (/asynchronous|message queue|event-driven|background/i.test(sentence)
            ? 3
            : 0) +
          (/real-time|bidirectional|websocket|push|dashboard|manual page refresh/i.test(
            sentence,
          )
            ? 3
            : 0) +
          (/live data|state management/i.test(sentence) ? 1 : 0) -
          (/^In Phase 2\b/i.test(sentence) ? 2 : 0) +
          (/project goal|workstreams?|use case|agent role|technical feasibility|data readiness|roi/i.test(
            sentence,
          )
            ? 3
            : 0),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 4)
      .sort((a, b) => a.index - b.index)
      .map((item) => item.sentence);

    const riskSentences = /\brisk|risks\b/.test(cleanQuery)
      ? uniqueSentences
          .map((sentence, index) => ({
            sentence,
            index,
            score:
              (/risk|risks|hallucination|cost|token|pii|redaction|access|dependency|feasibility/i.test(
                sentence,
              )
                ? 3
                : 0) +
              (/ROI & Risk|Data Readiness|Technical Feasibility/i.test(sentence)
                ? 2
                : 0),
          }))
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score || a.index - b.index)
          .slice(0, 4)
          .sort((a, b) => a.index - b.index)
          .map((item) => item.sentence)
      : [];

    const details = supportingSentences.length
      ? ` The supporting details are: ${supportingSentences.join(" ")}`
      : "";
    const risks = riskSentences.length
      ? ` Risks to track include: ${riskSentences.join(" ")}`
      : "";

    return `${phaseMatch[0].replace(/\b\w/g, (char) => char.toUpperCase())} focuses on ${titleFocus}.${details}${risks}`;
  }

  async queryGroq(query, chunks) {
    const contextText = chunks
      .map((c, i) => `[Source ${i + 1}: ${c.metadata.title}]\n${c.content}`)
      .join("\n\n");
    const systemPrompt = `You are CollabAgent RAG AI Assistant. Answer the user question ONLY based on the provided retrieved documentation context. Treat document titles as source evidence, especially when they contain phase names or focus areas. If the context does not contain the answer, say "I cannot find this information in the project files." Do not make up answers.\n\nContext:\n{context}`;

    try {
      return await this.queryGroqMessages([
        {
          role: "system",
          content: systemPrompt.replace("{context}", contextText),
        },
        { role: "user", content: query },
      ]);
    } catch (err) {
      console.error("[GenerationService] Groq API execution failed:", err);
      if (this.geminiClient) return this.queryGemini(query, chunks);
      return this.localReasoningEngine(query, chunks);
    }
  }

  async queryOllama(query, chunks) {
    const contextText = chunks
      .map((c, i) => `[Source ${i + 1}: ${c.metadata.title}]\n${c.content}`)
      .join("\n\n");
    return this.queryOllamaMessages([
      {
        role: "system",
        content: `You are CollabAgent RAG AI Assistant. Answer the user question ONLY based on the provided retrieved documentation context. Treat document titles as source evidence, especially when they contain phase names or focus areas. If the context does not contain the answer, say "I cannot find this information in the project files." Do not make up answers.\n\nContext:\n${contextText}`,
      },
      { role: "user", content: query },
    ]);
  }

  async queryOllamaMessages(messages) {
    const response = await fetch(`${this.ollamaHost}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.ollamaModel,
        stream: false,
        messages,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(
        `Ollama request failed with ${response.status}: ${details}`,
      );
    }

    const data = await response.json();
    return data.message?.content || "";
  }

  async queryGroqMessages(messages) {
    const { StringOutputParser } = require("@langchain/core/output_parsers");
    const { ChatPromptTemplate } = require("@langchain/core/prompts");

    const prompt = ChatPromptTemplate.fromMessages(
      messages.map((message) => [message.role, message.content]),
    );
    const chain = prompt.pipe(this.groqClient).pipe(new StringOutputParser());
    return chain.invoke({});
  }

  async queryGemini(query, chunks) {
    const contextText = chunks
      .map((c, i) => `[Source ${i + 1}: ${c.metadata.title}]\n${c.content}`)
      .join("\n\n");
    const systemPrompt = `You are CollabAgent RAG AI Assistant. Answer the user question ONLY based on the provided retrieved documentation context. Treat document titles as source evidence, especially when they contain phase names or focus areas. If the context does not contain the answer, say "I cannot find this information in the project files." Do not make up answers.\n\nContext:\n${contextText}`;

    try {
      const response = await this.geminiClient.models.generateContent({
        model: this.geminiModel,
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nQuestion: ${query}` }],
          },
        ],
      });
      return response.text;
    } catch (err) {
      console.error("[GenerationService] Gemini API execution failed:", err);
      return this.localReasoningEngine(query, chunks);
    }
  }

  async queryGeminiMessages(messages) {
    const response = await this.geminiClient.models.generateContent({
      model: this.geminiModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: messages
                .map(
                  (message) =>
                    `${message.role.toUpperCase()}:\n${message.content}`,
                )
                .join("\n\n"),
            },
          ],
        },
      ],
    });
    return response.text;
  }

  async queryMistralMessages(messages) {
    try {
      const response = await this.mistralClient.chat.complete({
        model: process.env.MISTRAL_MODEL || "mistral-small-latest",
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });
      return response.choices[0].message.content;
    } catch (err) {
      console.error("[GenerationService] Mistral API failed:", err);
      throw err;
    }
  }
}

const generationServiceInstance = new GenerationService();
module.exports = generationServiceInstance;
