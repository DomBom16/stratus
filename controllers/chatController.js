const { v4: uuidv4 } = require("uuid");
const { openaiClient } = require("../config/openaiClient");
const Conversation = require("../models/Conversation");
const systemPrompt = require("../system-prompt");
const { waitingMessages } = require("../utils/waitingMessages");
const {
  handleFunctionCall,
  functionLoadMessages,
} = require("../utils/functionMaps");

const sequenceEnd = "<__sqnd__>";
const model = process.env.MODEL || "openai/gpt-4o-mini";

const processChatResponse = async (req, res) => {
  const conversationId = req.params.id;

  // Retrieve the conversation from the database
  const conversation = await Conversation.findOne({ id: conversationId });
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  // Prepare conversation history
  const history = conversation.messages.map((msg) => {
    if (msg.role === "assistant") {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Assistant message with tool calls
        return {
          role: "assistant",
          tool_calls: msg.tool_calls,
        };
      } else {
        // Assistant message without tool calls
        return {
          role: "assistant",
          content: msg.content,
        };
      }
    } else if (msg.role === "tool" && msg.tool_call_id) {
      // Tool's response
      return {
        role: "tool",
        content: msg.content,
        tool_call_id: msg.tool_call_id,
      };
    } else {
      // User messages and other roles
      return {
        role: msg.role,
        content: msg.content,
      };
    }
  });

  // Construct system message
  let systemMessage = systemPrompt;

  if (conversation.files.length > 0) {
    systemMessage +=
      "\n\nBelow is a list of files and websites that you should take into consideration and study.";
  }

  // Append unfocused files to the systemMessage
  conversation.files.forEach((file) => {
    const isFocused = conversation.focused_files.includes(file.id);

    if (!isFocused) {
      const unfocusedSummary = file.summaries.find((s) => !s.is_focused);

      if (file.type === "link") {
        systemMessage += `
<unfocused_webpage>
This content is from the link, ${file.original_name}. The webpage's title is "${file.name}".
<webpage_summary>
${unfocusedSummary ? unfocusedSummary.content : "No summary available."}
</webpage_summary>
</unfocused_webpage>\n`;
      } else if (file.type === "file") {
        systemMessage += `
<unfocused_file>
This content is from the file, "${file.name}".
<file_summary>
${unfocusedSummary ? unfocusedSummary.content : "No summary available."}
</file_summary>
</unfocused_file>\n`;
      } else if (file.type === "video") {
        systemMessage += `
<unfocused_video>
This content is from the YouTube video, "${file.name}".
<video_summary>
${unfocusedSummary ? unfocusedSummary.content : "No summary available."}
</video_summary>
</unfocused_video>\n`;
      }
    }
  });

  // Initialize the messages array with the system message
  const messages = [
    { role: "system", content: systemMessage },
    {
      role: "user",
      content: `${
        conversation.files.length > 0
          ? " In the next few messages are files and websites that you should take into consideration when creating your responses."
          : ""
      }`,
    },
  ];

  // Add focused files as user messages
  conversation.files.forEach((file) => {
    const isFocused = conversation.focused_files.includes(file.id);

    if (isFocused) {
      const focusedSummary = file.summaries.find((s) => s.is_focused);

      let userMessage = "";

      if (file.type === "link") {
        userMessage = `
<focused_webpage>
This content is from the link, ${file.original_name}. The webpage's title is "${file.name}". This webpage is focused and has a detailed summary; it should be prioritized.
<webpage_summary>
${focusedSummary ? focusedSummary.content : "No summary available."}
</webpage_summary>
</focused_webpage>`;
      } else if (file.type === "file") {
        userMessage = `
<focused_file>
This content is from the file, "${file.name}". This file is focused and has a detailed summary; it should be prioritized.
<file_summary>
${focusedSummary ? focusedSummary.content : "No summary available."}
</file_summary>
</focused_file>`;
      } else if (file.type === "video") {
        userMessage = `
<focused_video>
This content is from the YouTube video, "${file.name}". This video is focused and has a detailed summary; it should be prioritized.
<video_summary>
${focusedSummary ? focusedSummary.content : "No summary available."}
</video_summary>
</focused_video>`;
      }

      messages.push({ role: "user", content: userMessage.trim() });
    }
  });

  // Append the conversation history
  messages.push(...history);

  // Set headers for Server-Sent Events (SSE)
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let responseStarted = false;
  const responseTimeout = setTimeout(() => {
    if (!responseStarted) {
      res.write(
        JSON.stringify({
          type: "loader",
          data: `Just wait, I'm ${waitingMessages[
            Math.floor(Math.random() * waitingMessages.length)
          ].toLowerCase()}`,
        }) + sequenceEnd,
      );
    }
  }, 0);

  // Define the tools/functions available to the assistant
  const tools = [
    {
      type: "function",
      function: {
        name: "random_number",
        description: "Generates a random number; min=0, max=100",
        parameters: {
          type: "object",
          properties: {
            min: {
              type: "number",
              description: "The minimum value of the range",
            },
            max: {
              type: "number",
              description: "The maximum value of the range",
            },
          },
          required: ["min", "max"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "calculate",
        description:
          'Calculates the result of an expression using evaluatex; Examples include "2 + 2", "sin(PI / 2) + LN2 ^ E + hypot(3, 4)", "4a(1 + b)", "\\frac 1{20}3".',
        parameters: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "The expression to evaluate",
            },
            latex: {
              type: "boolean",
              description: "Whether to parse the expression as LaTeX or ASCII",
            },
          },
          required: ["expression"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "google_search",
        description: "Searches Google for the given query",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The query to search for",
            },
            numResults: {
              type: "number",
              description: "The number of results to return",
            },
          },
          required: ["query", "numResults"],
        },
      },
    },
  ];

  try {
    // Initiate the OpenAI API request with streaming
    const stream = await openaiClient.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: "auto",
      stream: true,
      max_tokens: 8000,
      temperature: 0.7,
    });

    let assistantContent = "";
    let bufferedFunctionCall = {
      functionName: "",
      functionArgs: "",
      toolId: "",
    };
    let previousIndex = 0;

    // Helper function to format function names
    function toTitleCase(str) {
      return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      });
    }

    // Process the streamed response
    for await (const chunk of stream) {
      if (!responseStarted) {
        clearTimeout(responseTimeout);
        responseStarted = true;
      }

      const content = chunk.choices[0]?.delta?.content || "";
      const toolId = chunk.choices[0]?.delta?.tool_calls?.[0]?.id || null;
      const functionCall = chunk.choices[0]?.delta?.tool_calls;
      const functionName = functionCall?.[0]?.function?.name ?? null;
      const functionArgs = functionCall?.[0]?.function?.arguments ?? null;
      const currentIndex = functionCall?.[0]?.index ?? null;

      // Handle function call initiation
      if (functionName) {
        bufferedFunctionCall.functionName = functionName;
        res.write(
          JSON.stringify({
            type: "loader",
            data:
              functionLoadMessages[functionName][
                Math.floor(
                  Math.random() * functionLoadMessages[functionName].length,
                )
              ] || `Running ${toTitleCase(functionName.replace("_", " "))}`,
          }) + sequenceEnd,
        );
      }

      if (toolId) {
        bufferedFunctionCall.toolId = toolId;
      }

      // Process function calls
      if (bufferedFunctionCall.functionName) {
        if (previousIndex !== currentIndex) {
          // New function call detected
          try {
            const result = await handleFunctionCall(
              bufferedFunctionCall.functionName,
              bufferedFunctionCall.functionArgs,
            );

            // Create messages for the assistant's function call and the tool's response
            const assistantFunctionMessage = {
              id: uuidv4(),
              role: "assistant",
              tool_calls: [
                {
                  id: bufferedFunctionCall.toolId,
                  type: "function",
                  function: {
                    name: bufferedFunctionCall.functionName,
                    arguments: bufferedFunctionCall.functionArgs,
                  },
                },
              ],
              date_created: new Date(),
            };

            const toolMessage = {
              id: uuidv4(),
              role: "tool",
              content: result.toString(),
              tool_call_id: bufferedFunctionCall.toolId,
              date_created: new Date(),
            };

            // Save messages to the conversation
            conversation.messages.push(assistantFunctionMessage);
            conversation.messages.push(toolMessage);
            conversation.last_updated = new Date();
            await conversation.save();

            // Send the tool call result back to the client
            res.write(
              JSON.stringify({
                type: "tool_call",
                data: [assistantFunctionMessage, toolMessage],
              }) + sequenceEnd,
            );
          } catch (error) {
            res.write(
              JSON.stringify({
                type: "error",
                data: `Error: ${error.message}`,
              }) + sequenceEnd,
            );
          }

          // Reset the buffer for the next function call
          bufferedFunctionCall = {
            functionName: "",
            functionArgs: "",
            toolId: "",
          };
          previousIndex = currentIndex;
        } else {
          // Accumulate function arguments
          bufferedFunctionCall.functionArgs += functionArgs;
        }
      } else if (content) {
        // Accumulate assistant's content response
        assistantContent += content;
        res.write(
          JSON.stringify({ type: "content", data: content }) + sequenceEnd,
        );
      }
    }

    // After the stream ends, save the assistant's message
    if (assistantContent.trim() !== "") {
      const assistantMessage = {
        id: uuidv4(),
        role: "assistant",
        content: assistantContent,
        date_created: new Date(),
      };

      conversation.messages.push(assistantMessage);
      conversation.last_updated = new Date();
      await conversation.save();
    }

    res.end();
  } catch (error) {
    console.error("Error in /chat/response/answer:", error);
    res.write(
      JSON.stringify({
        type: "error",
        data:
          error.message ||
          "An error occurred while processing your request. Please try again later.",
      }) + sequenceEnd,
    );
    res.end();
  }
};

module.exports = { processChatResponse };
