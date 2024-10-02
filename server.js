// server.js
const express = require("express");
const path = require("path");
const { connectDB } = require("./config/db");
const conversationRoutes = require("./routes/conversations");
const fileRoutes = require("./routes/files");
const chatRoutes = require("./routes/chat");
const { cleanUpConversations } = require("./utils/cleanup");

// Initialize
const mongoose = require("mongoose");
const dotenv = require("./config/dotenvConfig");
const { openaiClient } = require("./config/openaiClient");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static("public"));

// Routes
app.use("/api/conversations", conversationRoutes);
app.use("/api/conversations", fileRoutes);
app.use("/api/chat", chatRoutes);

// Serve the index.html file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Serve the frontend for /chat/:id routes
app.get("/chat/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Connect to MongoDB and start the server
connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      // Start periodic cleanup
      cleanUpConversations();
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error);
  });
