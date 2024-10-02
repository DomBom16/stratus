// routes/files.js
const express = require("express");
const router = express.Router();
const multerConfig = require("../middlewares/multerConfig");
const {
  processUploadedFile,
  processUploadedLink,
} = require("../utils/processFile");
const Conversation = require("../models/Conversation");

// Upload a file to a conversation
router.post(
  "/:id/upload/file",
  multerConfig.single("file"),
  async (req, res) => {
    const conversationId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      const result = await processUploadedFile(file, conversationId);
      res.json(result);
    } catch (error) {
      console.error("Error processing uploaded file:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Upload a link to a conversation
router.post("/:id/upload/url", async (req, res) => {
  const conversationId = req.params.id;
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "No URL provided" });
  }

  try {
    const result = await processUploadedLink(url, conversationId);
    res.json(result);
  } catch (error) {
    console.error("Error processing uploaded link:", error);
    res.status(500).json({ error: error.message });
  }
});

// Modify the name of a file
router.post("/:id/files/:fileId/name", async (req, res) => {
  const conversationId = req.params.id;
  const fileId = req.params.fileId;
  try {
    const conversation = await Conversation.findOne({ id: conversationId });
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    const file = conversation.files.find((f) => f.id === fileId);
    if (!file) {
      throw new Error("File not found");
    }
    file.name = req.body.name;
    await conversation.save();
    res.json({ name: file.name });
  } catch (error) {
    console.error("Error updating file name:", error);
    res.status(500).json({ error: error.message });
  }
});

// Focus/unfocus a file
router.post("/:id/focus/:fileId", async (req, res) => {
  const conversationId = req.params.id;
  const fileId = req.params.fileId;
  try {
    const conversation = await Conversation.findOne({ id: conversationId });
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    const focused = !conversation.focused_files.includes(fileId);

    if (focused) {
      conversation.focused_files.push(fileId);
    } else {
      conversation.focused_files = conversation.focused_files.filter(
        (f) => f !== fileId,
      );
    }
    await conversation.save();
    res.json({ focused, focused_files: conversation.focused_files });
  } catch (error) {
    console.error("Error focusing/unfocusing file:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
