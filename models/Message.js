const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  id: String,
  role: String,
  content: String,
  date_created: Date,
  tool_calls: [mongoose.Schema.Types.Mixed],
  tool_call_id: String,
});

module.exports = mongoose.model("Message", MessageSchema);
