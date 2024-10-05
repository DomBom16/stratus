const evaluatex = require("evaluatex");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { openaiClient } = require("../config/openaiClient");

const functionLoadMessages = {
  random_number: [
    "Rolling the dice with Random Number Generator",
    "Randomizing the results using Random Number Generator",
    "Spinning the wheel of chance with Random Number Generator",
    "Generating some randomness using Random Number Generator",
    "Shuffling the deck of possibilities with Random Number Generator",
    "Drawing from the luck jar with Random Number Generator",
    "Letting fate decide through Random Number Generator",
    "Giving chance a whirl with Random Number Generator",
  ],
  calculate: [
    "Cranking out the calculations with Calculator",
    "Running the math using Calculator",
    "Doing the numbers with Calculator",
    "Crunching the figures using Calculator",
    "Solving the equation with Calculator",
    "Breaking down the math using Calculator",
    "Working the algorithm through Calculator",
    "Tallying it up with Calculator",
  ],
  google_search: [
    "Scouring the depths of the internet with Google Search",
    "Searching high and low using Google Search",
    "Hunting down the answers with Google Search",
    "Digging through the web archives using Google Search",
    "Exploring the internet jungle with Google Search",
    "Rummaging through search results using Google Search",
    "Scanning the online universe with Google Search",
    "Fetching knowledge from the net with Google Search",
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
  google_search: async function (query, numResults = 5) {
    const apiKey = process.env.GOOGLE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;

    if (!apiKey || !cseId) {
      throw new Error(
        "Google API Key or Custom Search Engine ID (CSE ID) is not defined in the environment variables.",
      );
    }

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

      results.push({
        content: `Remember to cite your sources using the format <source sname="NAME surl="URL" sxxx="..."></source>. All available attributes are as follows:

- sname: The name of the source
- surl: The URL of the source
- sauthor1-first-name: First name of the first author
- sauthor1-last-name: Last name of the first author
- sauthor2-first-name: First name of the second author
- sauthor2-last-name: Last name of the second author
- sauthorN-first-name: First name of the Nth author
- sauthorN-last-name: Last name of the Nth author
- syear: Year of publication
- smonth: Month of publication
- sday: Day of publication
- ssubtitle: Subtitle of the article
- spublisher: Publisher of the article
- ssite-name: Name of the site where the article is published
- spublication-date: Publication date of the article
- saccess-date: Date when the article was accessed

Using as many attributes as possible is beneficial to the user if they wish to refer to the sources.`,
      });

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

          // Summarize the content using OpenAI
          const response = await openaiClient.chat.completions.create({
            model: process.env.MODEL || "openai/gpt-4o-mini",
            max_tokens: 2048,
            temperature: 0.5,
            messages: [
              {
                role: "system",
                content: `${content}\n\nUsing the above content, write a detailed summary of the content (around 50% of the text length). It should be plain sentences, no bullets or over-the-top markdown formatting. YOU MAY NOT OMIT IMPORTANT INFORMATION, INCLUDING: THE NAME OF THE SOURCE, THE FIRST AND LAST NAME OF ALL AUTHORS, THE YEAR, MONTH, AND DAY OF PUBLICATION, THE SUBTITLE OF THE ARTICLE, THE PUBLISHER, THE NAME OF THE SITE WHERE THE ARTICLE IS PUBLISHED, AND THE PUBLICATION DATE. You should include this important information in the summary. The body of the content should be around 50%-75% of the originaltext length.`,
              },
            ],
          });

          const summary = response.choices[0].message.content.trim();

          // Add the result to the array
          results.push({
            title,
            link,
            content: summary,
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
