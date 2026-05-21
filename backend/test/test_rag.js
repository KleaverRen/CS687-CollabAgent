const eventBroker = require("/Users/rothpanhasethim/Downloads/CityU/CS687/CS687-CollabAgent/backend/services/eventBroker");
const vectorStorage = require("/Users/rothpanhasethim/Downloads/CityU/CS687/CS687-CollabAgent/backend/services/vectorStorage");
const generationService = require("/Users/rothpanhasethim/Downloads/CityU/CS687/CS687-CollabAgent/backend/services/generationService");

// Force evaluation to register background consumers
require("/Users/rothpanhasethim/Downloads/CityU/CS687/CS687-CollabAgent/backend/services/documentService");
require("/Users/rothpanhasethim/Downloads/CityU/CS687/CS687-CollabAgent/backend/services/embeddingService");

const PROJECT_ID = "9498bf66-ec00-47d4-9731-253ef582ae56"; // Sample project UUID

// Sample document contents to ingest
const docTitle = "SSO Security Configuration Policy";
const docContent = `
To configure Single Sign-On (SSO) for CollabAgent, navigate to the Settings > Security panel in your admin dashboard.
Ensure that your SAML 2.0 Identity Provider (IdP) metadata XML is uploaded correctly.
Once uploaded, map the user email attribute to the NameID field in your identity provider settings.
For security compliance, all session tokens expire after 24 hours of inactivity.
If you experience authorization failures, ensure your network allows traffic from outbound port 443.
`;

console.log("🏁 Starting Event-Driven RAG Microservices Integration Test...\n");

// 1. Set up a listener to monitor and print out all asynchronous microservice events
eventBroker.on("*", (event) => {
  console.log(`\n======================================================`);
  console.log(`🔔 LIVE EVENT CAPTURED: [${event.topic}]`);
  console.log(`🆔 ID: ${event.event_id} | 🕒 ${event.timestamp}`);
  console.log(`📦 Payload Summary:`, {
    documentId: event.payload.documentId,
    projectId: event.payload.projectId,
    title: event.payload.title,
    chunksCount: event.payload.chunks ? event.payload.chunks.length : undefined,
    vectorsCount: event.payload.vectors
      ? event.payload.vectors.length
      : undefined,
    indexedCount: event.payload.chunkCount || undefined,
  });
  console.log(`======================================================\n`);
});

// 2. Publish initial Document Created event to kick off the background worker pipeline
console.log("1️⃣ Simulating a user uploading a security document...");
eventBroker.publish("document.created", {
  documentId: "doc_sso_test_99",
  projectId: PROJECT_ID,
  title: docTitle,
  content: docContent,
  metadata: {
    author: "Rothpanhaseth Im",
    tenant_id: "collab_tenant_01",
  },
});

// 3. Wait for the event-loop to process all asynchronous hops (Created -> Chunked -> Embedded -> Indexed)
// Since each step has a slight eventBroker delay (200ms), we wait 2 seconds.
setTimeout(async () => {
  console.log(
    "\n--- Pipeline processing wait finished. Starting Query Phase ---",
  );

  // Verify that document chunks are in the vector index
  console.log(`🔍 Total indexed chunks: ${vectorStorage.index.length}`);

  // 4. Submit a user query to verify semantic vector alignment and local reasoning answer generation!
  const queryText = "How do I set up SSO SAML?";
  console.log(`\n2️⃣ Querying: "${queryText}"`);

  try {
    const response = await generationService.generateAnswer(
      queryText,
      PROJECT_ID,
    );

    console.log("\n🎯 ANSWER RETURNED FROM RAG ENGINE:");
    console.log(response.answer);

    console.log("\n📚 SOURCES RECOVERY DETAILS:");
    console.log(JSON.stringify(response.sources, null, 2));

    console.log("\n✅ Event-Driven RAG Microservices validation successful!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Query execution failed:", err);
    process.exit(1);
  }
}, 2500);
