// models/Conversation.js
const mongoose = require("mongoose");
const Message = require("./Message");
const File = require("./File");

const ConversationSchema = new mongoose.Schema({
  id: String,
  name: String,
  date_created: Date,
  last_updated: Date,
  focused_files: [String],
  messages: [Message.schema],
  files: [File.schema],
});

module.exports = mongoose.model("Conversation", ConversationSchema);
