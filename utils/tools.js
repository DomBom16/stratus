const { evaluate, format } = require("mathjs");
const fetch = require("node-fetch");
const { openaiClient } = require("../config/openaiClient");
const { Readability } = require("@mozilla/readability");
const { JSDOM } = require("jsdom");

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
    "Fetching knowledge from the internet with Google Search",
  ],
};

const functionFinishMessages = {
  random_number: [
    "Rolled the dice with Random Number Generator",
    "Randomized the results using Random Number Generator",
    "Spun the wheel of chance with Random Number Generator",
    "Generated some randomness using Random Number Generator",
    "Shuffled the deck of possibilities with Random Number Generator",
    "Drew from the luck jar with Random Number Generator",
    "Let fate decide through Random Number Generator",
    "Gave chance a whirl with Random Number Generator",
  ],
  calculate: [
    "Cranked out the calculations with Calculator",
    "Ran the math using Calculator",
    "Did the numbers with Calculator",
    "Crunched the figures using Calculator",
    "Solved the equation with Calculator",
    "Broke down the math using Calculator",
    "Worked the algorithm through Calculator",
    "Tallied it up with Calculator",
  ],
  google_search: [
    "Scoured the depths of the internet with Google Search",
    "Searched high and low using Google Search",
    "Hunted down the answers with Google Search",
    "Dug through the web archives using Google Search",
    "Explored the internet jungle with Google Search",
    "Rummaged through search results using Google Search",
    "Scanned the online universe with Google Search",
    "Fetched knowledge from the internet with Google Search",
  ],
};

const functionParamNames = {
  random_number: ["min", "max"],
  calculate: ["expression", "latex"],
  google_search: ["query", "numResults"],
};

const functionMap = {
  random_number: async function (min = 1, max = 100, n = 1) {
    if (min >= max) {
      throw new Error("Minimum value must be less than maximum value");
    }
    const numbers = [];
    for (let i = 0; i < n; i++) {
      numbers.push(Math.floor(Math.random() * (max - min) + min));
    }
    return numbers;
  },
  calculate: async function (expression) {
    if (!expression) {
      return NaN;
    }
    try {
      return format(evaluate(expression), { notation: "fixed", precision: 10 });
    } catch (error) {
      throw new Error(`Error evaluating expression: ${error.message}`);
    }
  },
  google_search: async function (query, numResults = 5) {
    const apiKey = process.env.GOOGLE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;
    const model = process.env.MODEL || "openai/gpt-4o-mini";

    numResults = Math.min(numResults, 10);

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

      const items = searchData.items || [];
      const results = [];

      const { default: pLimit } = await import("p-limit");
      const limiter = pLimit(10); // Set concurrency limit

      // Cache to store processed results to avoid duplicate processing
      const processedCache = new Map();

      const itemPromises = items.map((item) =>
        limiter(async () => {
          const { title, link } = item;

          if (processedCache.has(link)) {
            return processedCache.get(link);
          }

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

            // Parse the HTML using JSDOM and Readability
            const dom = new JSDOM(html, { url: link });
            const document = dom.window.document;

            // // Remove script and style tags
            // ["script", "style"].forEach((tag) => {
            //   const elements = document.querySelectorAll(tag);
            //   elements.forEach((el) => el.remove());
            // });

            const readability = new Readability(document);
            const article = readability.parse();

            if (!article || !article.textContent) {
              throw new Error("No readable content found.");
            }

            // Use the original text content and perform citation extraction concurrently
            const [citationResponse] = await Promise.all([
              openaiClient.chat.completions.create({
                model: model,
                messages: [
                  {
                    role: "system",
                    content: `You are CitationGPT. Given the user's text, your response should be a list of components that can be used to cite the source. Do not start your responses with "Sure, here's the citation" or similar text. Do not use bullets. Extract the key information needed to cite the following source. Provide the details in the exact XML format following exact XML format without extra text or bullets:

<source sdisplay="DISPLAY" stitle="TITLE" surl="URL" ssite-name="SITE_NAME" sxxx="..."></source>

Attributes to include:

- sdisplay: A 1-4 word shortening of the title; used in the user's display
- stitle: The name of the source
- sauthor1-first-name: First name of the first author
- sauthor1-last-name: Last name of the first author
- sauthor2-first-name: First name of the second author
- sauthor2-last-name: Last name of the second author
- sauthorN-first-name: First name of the Nth author
- sauthorN-last-name: Last name of the Nth author
- syear: Year of publication in YYYY
- smonth: Month of publication in MM, zero-padded
- sday: Day of publication in DD, zero-padded
- ssubtitle: Subtitle of the article
- spublisher: Publisher of the article
- ssite-name: Name of the site where the article is published
- spublication-year: Year of publication in YYYY
- spublication-month: Month of publication in MM, zero-padded
- spublication-day: Day of publication in DD, zero-padded
- saccess-date: Date when the article was accessed in YYYY-MM-DD format

Ensure that you include only the specified attributes and follow the format precisely. Do not add any explanations or additional text. If you cannot find the information for a particular component, do not include it. Today's date is ${new Date().toISOString().split("T")[0]}. The webpage is ${link}.`,
                  },
                  {
                    role: "user",
                    content: article.textContent.trim(),
                  },
                ],
                max_tokens: 500,
                temperature: 0.3,
              }),
            ]);

            const citation =
              citationResponse.choices[0].message.content.trim() +
              "\nPLEASE MAKE SURE TO USE SVERBATIM WHEN USING THIS, AN ATTRIBUTE THAT CONTAINS THE VERBATIM EXCERPT OF THE SOURCE USED TO DERIVE THE ANSWER.";

            const result = {
              title,
              link,
              citation_info: citation,
              content: article.textContent.trim(),
            };

            // Cache the processed result
            processedCache.set(link, result);

            return result;
          } catch (pageError) {
            console.error(`Error processing ${link}: ${pageError.message}`);
            return {
              title,
              link,
              citation_info: "",
              content: "",
              error: pageError.message,
            };
          }
        }),
      );

      const processedItems = await Promise.all(itemPromises);
      results.push(...processedItems);

      return JSON.stringify(results);
    } catch (error) {
      console.error(`Error in google_search: ${error.message}`);
      throw error; // Re-throw the error after logging
    }
  },
};

async function handleFunctionCall(name, args) {
  const fn = functionMap[name];
  const paramNames = functionParamNames[name];

  if (!fn || !paramNames) {
    return;
  }

  const parsedArgs = args;

  const finalArgs = paramNames.map((paramName) =>
    parsedArgs.hasOwnProperty(paramName) ? parsedArgs[paramName] : undefined,
  );

  return await fn(...finalArgs);
}

module.exports = {
  functionLoadMessages,
  functionFinishMessages,
  functionParamNames,
  functionMap,
  handleFunctionCall,
};
