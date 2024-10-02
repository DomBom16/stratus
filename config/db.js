// config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoURI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/chatdb";
  await mongoose.connect(mongoURI);
  console.log("Connected to MongoDB");
};

module.exports = { connectDB };
