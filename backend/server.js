require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const userRoutes = require("./routes/users");
const taskRoutes = require("./routes/tasks");
const aiRoutes = require("./routes/ai_suggestions");
const aiWorkbenchRoutes = require("./routes/ai_workbench");
const ragRoutes = require("./routes/rag");
const documentRoutes = require("./routes/documents");
const notificationRoutes = require("./routes/notifications");
const chatRoutes = require("./routes/chat");
const agentTaskRoutes = require("./routes/agents/task");
const coordinationRoutes = require("./routes/agents/coordination");
const feedbackRoutes = require("./routes/agents/feedback");
const progressRoutes = require("./routes/agents/progress");
const {
  startScheduler: startDeadlineScheduler,
  stopScheduler: stopDeadlineScheduler,
} = require("./services/deadlineReminderService");

const app = express();
const PORT = process.env.PORT || 3001;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set to at least 32 characters.");
}

app.set("trust proxy", 1);

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 100 : Infinity,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 5 : Infinity,
  message: { error: "Too many attempts, please try again later." },
});

app.use(limiter);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/projects/:id/documents", documentRoutes);
app.use("/api/projects/:projectId/chat", chatRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/ai-workbench", aiWorkbenchRoutes);
app.use("/api/agents/rag", ragRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/agents/task", agentTaskRoutes);
app.use("/api/agents/coordination", coordinationRoutes);
app.use("/api/agents/feedback", feedbackRoutes);
app.use("/api/agents/progress", progressRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

const server = app.listen(PORT, () => {
  console.log(`
🚀 CollabAgent API running on http://localhost:${PORT}
📊 Environment: ${process.env.NODE_ENV || "development"}
🔗 Health: http://localhost:${PORT}/health
  `);

  // Start the deadline reminder scheduler
  startDeadlineScheduler();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  stopDeadlineScheduler();
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  stopDeadlineScheduler();
  server.close(() => process.exit(0));
});

module.exports = app;
