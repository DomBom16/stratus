const { v4: uuidv4 } = require("uuid");
const { openaiClient } = require("../config/openaiClient");

const {
  handleFunctionCall,
  functionLoadMessages,
  functionFinishMessages,
} = require("../utils/tools");

const model = process.env.MODEL || "openai/gpt-4o-mini";

const MAX_RECURSION_DEPTH = 10; // Set a limit to prevent infinite loops

// Keep track of loaders as an array of strings
let loaders = [];

async function processStream(
  messages,
  res,
  conversation,
  recursionDepth,
) {
  if (recursionDepth > MAX_RECURSION_DEPTH) {
    throw new Error("Maximum recursion depth exceeded.");
  }

  if (recursionDepth === 0) {
    loaders = [];
  }

  const tools = [
    {
      type: "function",
      function: {
        name: "random_number",
        description: "Generates a random number; minValue=0, maxValue=100, count=1",
        parameters: {
          type: "object",
          properties: {
            minValue: {
              type: "number",
              description: "The minimum value of the range",
            },
            maxValue: {
              type: "number",
              description: "The maximum value of the range",
            },
            count: {
              type: "number",
              description: "The number of random numbers to generate",
            },
          },
          required: ["minValue", "maxValue", "count"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "calculate",
        description:
          'Calculates the result of an expression using evaluatex; Examples include "2 + 2", "sin(56deg) + 23*pi + e/4", "4a(1 + b)"',
        parameters: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "The expression to evaluate",
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
            },
            numResults: {
              type: "number",
            },
          },
          required: ["query", "numResults"],
        },
      },
    },
  ];

  let assistantContent = "";
  let bufferedFunctionCall = {
    functionName: "",
    functionArgs: "",
    toolId: "",
  };

  function toTitleCase(str) {
    return str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }

  // Initiate the OpenAI API request with streaming
  const stream = await openaiClient.chat.completions.create({
    model,
    messages,
    tools,
    tool_choice: "auto",
    stream: true,
    max_tokens: 8000,
    temperature: 0.8,
    transforms: ["middle_out"]
  });

  let prevToolIndex = -1;

  // Process the streamed response
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    const finishReason = chunk.choices[0]?.finish_reason;

    // Check if the delta includes a function call
    if (delta?.tool_calls) {
      const functionCall = delta.tool_calls[0];
      const functionName = functionCall?.function?.name;
      const functionArgs = functionCall?.function?.arguments ?? "";
      const toolIndex = functionCall?.index;

      if (toolIndex !== prevToolIndex) {
        // Start accumulating function call data
        if (functionName) {
          bufferedFunctionCall.functionName = functionName;
          bufferedFunctionCall.functionArgs = "";
          bufferedFunctionCall.toolId = functionCall.id;
        }

        prevToolIndex = toolIndex;
      }

      // Accumulate function arguments
      bufferedFunctionCall.functionArgs += functionArgs;
    }

    // Check if the function call is complete
    if (finishReason === "tool_calls" && bufferedFunctionCall.functionName) {
      // Function call is complete, process it
      try {
        const functionName = bufferedFunctionCall.functionName;

        const loaderMessage =
          (functionLoadMessages[functionName] &&
            functionLoadMessages[functionName][
              Math.floor(
                Math.random() * functionLoadMessages[functionName].length,
              )
            ]) ||
          (functionName
            ? `Running ${toTitleCase(functionName.replace("_", " "))}`
            : "Running a tool");

        res.write(
          `event: loader\ndata: ${JSON.stringify({
            data: loaderMessage,
            loaderType: "tool",
            toolId: bufferedFunctionCall.toolId,
          })}\n\n`,
        );

        const result = await handleFunctionCall(
          bufferedFunctionCall.functionName,
          JSON.parse(bufferedFunctionCall.functionArgs),
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

        res.write(
          `event: tool_call\ndata: ${JSON.stringify({
            data: [assistantFunctionMessage, toolMessage],
          })}\n\n`,
        );

        const finishedMessage =
          functionFinishMessages[bufferedFunctionCall.functionName][
            Math.floor(
              Math.random() *
                functionFinishMessages[bufferedFunctionCall.functionName]
                  .length,
            )
          ] ||
          `Finished running ${toTitleCase(
            bufferedFunctionCall.functionName.replace("_", " "),
          )}`;

        // Send a loader_update event to indicate the tool has finished
        res.write(
          `event: loader_update\ndata: ${JSON.stringify({
            toolId: bufferedFunctionCall.toolId,
            data: finishedMessage,
          })}\n\n`,
        );

        loaders.push(finishedMessage);

        // Prepare messages for the new API call
        const newMessages = messages.concat([
          {
            role: "assistant",
            tool_calls: assistantFunctionMessage.tool_calls,
          },
          {
            role: "tool",
            content: toolMessage.content,
            tool_call_id: toolMessage.tool_call_id,
          },
        ]);

        // Recursively call processOpenAIStream with updated messages
        await processStream(
          newMessages,
          res,
          conversation,
          recursionDepth + 1,
        );

        // After recursive call, return to prevent further processing
        return;
      } catch (error) {
        console.error("Error running function call:", error);
        res.write(
          `event: error\ndata: ${JSON.stringify({
            data: `Error: ${error.message}`,
          })}\n\n`,
        );
      }

      // Reset the buffer for the next function call
      bufferedFunctionCall = {
        functionName: "",
        functionArgs: "",
        toolId: "",
      };
    } else if (delta?.content) {
      // Accumulate assistant's content response
      assistantContent += delta.content;
      res.write(
        `event: content\ndata: ${JSON.stringify({
          data: delta.content,
          role: "assistant",
          timestamp: new Date().toISOString(),
        })}\n\n`,
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
      loaders,
    };

    conversation.messages.push(assistantMessage);
    conversation.last_updated = new Date();
    await conversation.save();
  }
}

module.exports = { processStream };
