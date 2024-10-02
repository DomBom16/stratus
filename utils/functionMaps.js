// utils/functionMaps.js
const evaluatex = require("evaluatex");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const functionLoadMessages = {
  random_number: [
    "Rolling the dice",
    "Randomizing the results",
    "Spinning the wheel of chance",
  ],
  calculate: [
    "Cranking out the calculations",
    "Running the math",
    "Doing the numbers",
  ],
  google_search: [
    "Scouring the depths of the internet",
    "Searching high and low",
    "Hunting down the answers",
  ],
};

const functionParamNames = {
  random_number: ["min", "max"],
  calculate: ["expression", "latex"],
  google_search: ["query", "numResults"],
};

const functionMap = {
  random_number: async function (min = 1, max = 100) {
    if (min >= max) {
      throw new Error("Minimum value must be less than maximum value");
    }
    return Math.floor(Math.random() * (max - min) + min);
  },
  calculate: async function (expression, latex = false) {
    if (!expression) {
      return NaN;
    }
    expression = expression.replace(/math\./gi, "").replace("pi", "PI");
    try {
      const fn = evaluatex(expression, { latex });
      const result = fn();
      return result;
    } catch (error) {
      throw new Error(`Error evaluating expression: ${error.message}`);
    }
  },
  google_search: async function (query, numResults = 10) {
    const apiKey = process.env.GOOGLE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;

    if (!apiKey || !cseId) {
      throw new Error(
        "Google API Key or Custom Search Engine ID (CSE ID) is not defined in the environment variables.",
      );
    }

    numResults = 3;

    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(
      query,
    )}&num=${numResults}`;

    try {
      // Fetch search results from Google Custom Search API
      const searchResponse = await fetch(searchUrl);
      if (!searchResponse.ok) {
        throw new Error(
          `Google Search API error: ${searchResponse.statusText}`,
        );
      }
      const searchData = await searchResponse.json();

      // Extract relevant information
      const items = searchData.items || [];
      const results = [];

      // Iterate over each search result
      for (const item of items) {
        const { title, link } = item;
        try {
          // Fetch the webpage content
          const pageResponse = await fetch(link, {
            headers: {
              "User-Agent": "Mozilla/5.0",
            },
          });
          if (!pageResponse.ok) {
            throw new Error(
              `Failed to fetch ${link}: ${pageResponse.statusText}`,
            );
          }
          const html = await pageResponse.text();

          // Load the HTML into Cheerio for parsing
          const $ = cheerio.load(html);

          // Remove script and style tags
          $("script, style, noscript").remove();

          // Extract text content
          const content = $("body").text().replace(/\s+/g, " ").trim();

          // Add the result to the array
          results.push({
            title,
            link,
            content,
          });
        } catch (pageError) {
          console.error(`Error processing ${link}: ${pageError.message}`);
          // Optionally, you can choose to add a placeholder or skip this result
          results.push({
            title,
            link,
            content: "",
            error: pageError.message,
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      return JSON.stringify(results);
    } catch (error) {
      throw new Error(`Error fetching search results: ${error.message}`);
    }
  },
};

async function handleFunctionCall(name, args) {
  const fn = functionMap[name];
  const paramNames = functionParamNames[name];

  if (fn && paramNames) {
    const parsedArgs = JSON.parse(args);

    const finalArgs = paramNames.map((paramName) =>
      parsedArgs.hasOwnProperty(paramName) ? parsedArgs[paramName] : undefined,
    );

    return await fn(...finalArgs);
  } else {
    throw new Error(
      `Function ${name} not implemented or parameter names not defined.`,
    );
  }
}

module.exports = {
  functionLoadMessages,
  functionParamNames,
  functionMap,
  handleFunctionCall,
};
