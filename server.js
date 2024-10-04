const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("./config/dotenvConfig");
const { connectDB } = require("./config/db");
const { openaiClient } = require("./config/openaiClient");
const conversationRoutes = require("./routes/conversations");
const fileRoutes = require("./routes/files");
const chatRoutes = require("./routes/chat");
const { cleanUpConversations } = require("./utils/cleanup");
const readline = require("readline");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static("public"));

// Routes


const rl = readline.createInterface({
  input: process.stdin,
  output: null,
});

rl.on("line", (input) => {
  if (input.trim() === "routes") {
    const allRoutes = [
      ...conversationRoutes.stack.map(
        (r) => `/api/conversation${r.route.path}`,
      ),
      ...chatRoutes.stack.map((r) => `/api/conversation${r.route.path}`),
      ...fileRoutes.stack.map((r) => `/api/content${r.route.path}`),
    ];
    allRoutes.forEach((route, index) => {
      console.log(`${(index + 1).toString().padStart(2, "0")}. ${route}`);
    });
  } else {
    console.log(`The command "${input}" is not recognized.`);
  }
});

app.use("/api/conversation", conversationRoutes);
app.use("/api/conversation", chatRoutes);
app.use("/api/content", fileRoutes);

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
