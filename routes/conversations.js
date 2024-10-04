const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const Conversation = require("../models/Conversation");

// Create a new conversation
router.post("/create", async (req, res) => {
  try {
    const conversation = new Conversation({
      id: uuidv4(),
      name: "New Chat",
      date_created: new Date(),
      last_updated: new Date(),
      messages: [],
      files: [],
      focused_files: [],
    });

    await conversation.save();
    res.json(conversation);
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get a conversation by ID
router.get("/:id", async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ id: req.params.id });
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    // filter out sensitive information like file summaries, _v, and _id's
    const { id, name, date_created, last_updated, messages, files, focused_files } = conversation;
    const filteredConversation = {
      id,
      name,
      // date_created,
      // last_updated,
      // messages: messages.map(({ id, role, content, tool_calls }) => ({ id, role, content, tool_calls })),
      messages: messages.map(({ role, content, tool_calls }) => ({ role, content, tool_calls })),
      files: files.map(({ id, name, original_name }) => ({ id, name, original_name })),
      focused_files,
    }
    res.json(filteredConversation);
  } catch (error) {
    console.error("Error getting conversation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Check if a conversation exists by ID
router.get("/exists/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const conversation = await Conversation.findOne({ id });
    if (conversation) {
      res.json({ exists: true });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error("Error checking conversation existence:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add a message to a conversation
router.post("/messages/:id", async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ id: req.params.id });
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const message = {
      id: uuidv4(),
      role: req.body.role,
      content: req.body.content,
      date_created: new Date(),
    };

    if (req.body.tool_calls && req.body.tool_calls.length > 0) {
      message.tool_calls = req.body.tool_calls;
    }

    conversation.messages.push(message);
    conversation.last_updated = new Date();
    await conversation.save();

    res.status(201).json({ message: "Message saved" });
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
