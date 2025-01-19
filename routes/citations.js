const express = require("express");
const router = express.Router();

const fetch = require("node-fetch");
const cheerio = require("cheerio");
const Fuse = require("fuse.js");

/**
 * POST /surrounding
 * Receives JSON: { url: string, snippet: string }
 * 1) Fetch the webpage,
 * 2) Parse out text,
 * 3) Fuzzy find snippet if exact match fails,
 * 4) Return the snippet with an additional 40 characters on each side
 */
router.post("/surrounding", async (req, res) => {
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

    // Remove leading and trailing whitespace, as well as all whitespace that is longer than 1 space
    text = text.trim().replace(/\s{2,}/g, " ");

    // Remove

    // Helper to return leading / snippet / trailing
    // matchIndex -> start index of the snippet
    // matchLength -> length of the snippet
    const getContextParts = (fullText, matchIndex, matchLength) => {
      const leadingStart = Math.max(0, matchIndex - 100);
      const trailingEnd = Math.min(
        fullText.length,
        matchIndex + matchLength + 100,
      );

      const leading = fullText.substring(leadingStart, matchIndex);
      const snippet = fullText.substring(matchIndex, matchIndex + matchLength);
      const trailing = fullText.substring(
        matchIndex + matchLength,
        trailingEnd,
      );

      return { leading, snippet, trailing };
    };

    // 3a) Attempt an exact match first
    let exactIndex = text.indexOf(snippet);

    if (exactIndex !== -1) {
      // Found exact snippet
      const context = getContextParts(text, exactIndex, snippet.length);
      // console.log("hi")
      return res.json({
        ...context,
        matches: true,
      });
    }

    // 3b) If no exact match, fall back to fuzzy search
    // Split the text into lines or paragraphs for the fuzzy search
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

    // console.log(sentences);

    // Configure Fuse
    const fuse = new Fuse(sentences, {
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.4, // Lower threshold for stricter matching
      distance: 50, // More sensitive to positional differences
      tokenize: true,
    });

    const results = fuse.search(snippet);
    if (!results.length) {
      // Could not find a fuzzy match
      return res.json({ leading: "", snippet, trailing: "", matches: false });
    }

    // console.log(results);

    // Grab the best fuzzy match
    const bestMatch = results[0].item;

    // console.log(bestMatch);

    // Now locate that best match text in our full text
    const fuzzyIndex = text.indexOf(bestMatch);
    console.log(fuzzyIndex);
    if (fuzzyIndex === -1) {
      // Safety check in case something goes awry
      return res.json({ leading: "", snippet, trailing: "", matches: false });
    }

    // If the snippet is actually contained within bestMatch, refine the index further
    let finalIndex = fuzzyIndex;
    const subIndex = bestMatch.indexOf(snippet);
    if (subIndex !== -1) {
      // Adjust to point to the snippet's actual position inside the bestMatch
      finalIndex += subIndex;
    }

    // Return leading / snippet / trailing from fuzzy match
    const context = getContextParts(text, finalIndex, snippet.length);
    return res.json({
      ...context,
      matches: true,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.toString() });
  }
});

module.exports = router;
