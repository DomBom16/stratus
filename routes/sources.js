const express = require("express");
const router = express.Router();

const fetch = require("node-fetch");
const cheerio = require("cheerio");
const Fuse = require("fuse.js");

const { openaiClient } = require("../config/openaiClient");

router.post("/excerpt", async (req, res) => {
  const { url, snippet } = req.body;

  if (!url || !snippet) {
    return res.status(400).json({ error: "Missing URL or snippet" });
  }

  try {
    // 1) Fetch the webpage HTML
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(400).json({ error: `Failed to fetch URL: ${url}` });
    }
    const html = await response.text();

    // 2) Parse out text from the HTML <body>
    const $ = cheerio.load(html);
    let text = $("body").text();

    // Remove scripts and styles
    text = text
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/g, "")
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/g, "");

    // Remove leading and trailing whitespace, as well as all whitespace that is longer than 1 space
    text = text.trim().replace(/\s{2,}/g, " ");

    // Narrow down the text to a group
    const chunks = [];
    const width = 1500;
    for (let i = 0; i < text.length; i += Math.ceil(width / 2)) {
      chunks.push(text.substring(i, i + width));
    }

    const fuse = new Fuse(chunks, {
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.6, // Lower threshold for stricter matching
    });

    const results = fuse.search(snippet);
    if (!results.length) {
      // Could not find a fuzzy match
      console.log("Could not find a fuzzy match");
      return res.json({ leading: "", snippet, trailing: "", matches: false });
    }

    // Grab the best fuzzy match
    const bestMatch = results[0].item;

    try {
      const response = await openaiClient.chat.completions.create({
        model: process.env.MODEL || "openai/gpt-4o-mini",
        max_tokens: 1024,
        temperature: 0.6,
        messages: [
          {
            role: "system",
            content:
              "You are a text extraction assistant. Do not invent content; extract exactly what is in the provided text. You should only respond in JSON without preamble, explainations, or code fences/backticks.",
          },
          {
            role: "user",
            content: `${bestMatch}\n\nWhat text comes before the snippet "${snippet}"? What text comes after the snippet "${snippet}"?. What is the actual text "${snippet}" is trying to describe? Answer in JSON with the keys "before", "snippet" and "after". Both the "before" and "after" text should be no longer than 100 characters, but at least 80 characters long. Reword the snippet to EXACTLY match the original text, since the snippet may not be exactly correct. The "before" and "after" text should be what came before/after the REWRITTEN snippet, not the original. However, before you answer, type the key "full" which is the combination of the "before", "snippet", and "after" text.

Example:
Input: "My name is Domenic Urso, I'm doing right now:"
Output: {"before":"Before I introduce myself, I want to tell you about oceans. The oceans are very important.","snippet":"My name is Domenic Urso and this is what I'm doing right now: ","after": "telling you, the audience, about my interests."}`,
          },
        ],
      });

      const content = response.choices[0].message.content.trim();

      // leading, snippet, trailing
      const result = JSON.parse(content);

      return res.json({
        leading: result.before,
        snippet: result.snippet,
        trailing: result.after,
        matches: true,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        trailing: "",
        snippet,
        leading: "",
        matches: false,
        error: err.toString(),
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      trailing: "",
      snippet,
      leading: "",
      matches: false,
      error: err.toString(),
    });
  }
});

module.exports = router;
