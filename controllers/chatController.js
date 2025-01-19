const Conversation = require("../models/Conversation");
const systemPrompt = require("../system-prompt");
const { waitingMessages } = require("../utils/waitingMessages");

const { processStream } = require("../controllers/streamController");

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
  const initialMessages = [
    { role: "system", content: systemMessage },
    {
      role: "user",
      content: `You should always use the google_search tool as if you were a search engine. Make sure to cite 2-3 sources per 4 sentences using the <source> tag.${
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

      initialMessages.push({ role: "user", content: userMessage.trim() });
    }
  });

  // Append the conversation history
  initialMessages.push(...history);

  // Set headers for Server-Sent Events (SSE)
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let responseStarted = false;
  const responseTimeout = setTimeout(() => {
    if (!responseStarted) {
      const loaderMessage = `Just wait, I'm ${waitingMessages[
        Math.floor(Math.random() * waitingMessages.length)
      ].toLowerCase()}`;
      res.write(
        `event: loader\ndata: ${JSON.stringify({
          data: loaderMessage,
          loaderType: "message",
        })}\n\n`,
      );
    }
  }, 0);

  // Start processing the conversation
  try {
    await processStream(
      initialMessages,
      res,
      conversation,
      0, // initial recursion depth
    );
    res.end();
  } catch (error) {
    console.error("Error in /chat/response/answer:", error);
    const errorMessage =
      error.message ||
      "An error occurred while processing your request. Please try again later.";
    res.write(
      `event: error\ndata: ${JSON.stringify({
        data: errorMessage,
        stack: error.stack,
      })}\n\n`,
    );
    res.end();
  }
};

module.exports = { processChatResponse };
