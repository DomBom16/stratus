// models/Summary.js
const mongoose = require("mongoose");

const SummarySchema = new mongoose.Schema({
  id: String,
  is_focused: Boolean,
  content: String,
  date_created: Date,
});

module.exports = mongoose.model("Summary", SummarySchema);
