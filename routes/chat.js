const express = require("express");
const router = express.Router();
const { openaiClient } = require("../config/openaiClient");
const Conversation = require("../models/Conversation");
const { processChatResponse } = require("../controllers/chatController");

// Generate a title for a message and update conversation title
router.post("/chat/title/:id", async (req, res) => {
  const { message } = req.body;
  const conversationId = req.params.id;

  try {
    const response = await openaiClient.chat.completions.create({
      model: process.env.MODEL,
      max_tokens: 64,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "Respond to the user's input with a title that encapsulates the meaning of the message. The title should be 3-4 words and should be general enough that it shouldn't have to change over the future of the conversation. Do not prefix any text (e.g., 'title:') to your response.",
        },
        { role: "user", content: message },
      ],
    });

    const title = response.choices[0].message.content.trim();

    // Update the conversation's name in the database
    await Conversation.findOneAndUpdate(
      { id: conversationId },
      { name: title, last_updated: new Date() },
      { new: true },
    );

    res.json({ response: title });
  } catch (error) {
    console.error("Error in /chat/title:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/chat/response/:id", processChatResponse);

module.exports = router;
