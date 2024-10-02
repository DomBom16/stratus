// models/File.js
const mongoose = require("mongoose");
const Summary = require("./Summary");

const FileSchema = new mongoose.Schema({
  id: String,
  original_name: String,
  name: String,
  type: String,
  date_uploaded: Date,
  summaries: [Summary.schema],
});

module.exports = mongoose.model("File", FileSchema);
