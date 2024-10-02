// config/openaiClient.js
const { OpenAI } = require("openai");

const openaiClient = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

module.exports = { openaiClient };
