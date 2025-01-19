const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const cheerio = require("cheerio");
const fetch = require("node-fetch");
const ytdl = require("ytdl-core");
const { openaiClient } = require("../config/openaiClient");
const Conversation = require("../models/Conversation");
const { extractTextFromFile } = require("./extractTextFromFile");

const model = process.env.MODEL || "openai/gpt-4o-mini";

async function processFile(textContent, model) {
  // Generate title for the content
  const titleResponse = await openaiClient.chat.completions.create({
    model: model,
    max_tokens: 64,
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content:
          "Respond to the user's input with a title that concisely describes the content in 3-4 words. Aim for a descriptive and specific title that captures the essence of the content. Do not prefix any text (e.g., 'title:') to your response.",
      },
      { role: "user", content: textContent },
    ],
  });
  const title = titleResponse.choices[0].message.content;

  // Generate brief (10%) and detailed (50%) summaries
  const [unfocusedResponse, focusedResponse] = await Promise.all([
    openaiClient.chat.completions.create({
      model: model,
      max_tokens: 1024,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `${textContent}\n\nUsing the above content, write a brief summary of the content (around 10% of the text length). It should be plain sentences, no bullets or over-the-top markdown formatting.`,
        },
      ],
    }),
    openaiClient.chat.completions.create({
      model: model,
      max_tokens: 4096,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `${textContent}\n\nUsing the above content, write a detailed summary of the content (around half of the text length). It should be plain sentences, no bullets or over-the-top markdown formatting. If the content is code, include the full code source.`,
        },
      ],
    }),
  ]);

  const unfocusedSummary = unfocusedResponse.choices[0].message.content;
  const focusedSummary = focusedResponse.choices[0].message.content;

  return { title, unfocusedSummary, focusedSummary };
}

async function processUploadedFile(file, conversationId) {
  try {
    const textContent = await extractTextFromFile(file);

    if (!textContent || textContent.trim().length === 0) {
      throw new Error("Failed to extract text from the file");
    }

    const { title, unfocusedSummary, focusedSummary } = await processFile(
      textContent,
      model,
    );

    const fileId = uuidv4();
    const newFile = {
      id: fileId,
      original_name: file.originalname,
      name: title,
      type: "file",
      date_uploaded: new Date(),
      summaries: [
        {
          id: uuidv4(),
          is_focused: false,
          content: unfocusedSummary,
          date_created: new Date(),
        },
        {
          id: uuidv4(),
          is_focused: true,
          content: focusedSummary,
          date_created: new Date(),
        },
      ],
    };

    const conversation = await Conversation.findOne({ id: conversationId });
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    conversation.files.push(newFile);
    conversation.last_updated = new Date();
    await conversation.save();

    return { name: title, id: fileId };
  } finally {
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
}

async function processUploadedLink(url, conversationId) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch the URL");
    }

    const contentType = response.headers.get("content-type");

    if (contentType && contentType.startsWith("text/html")) {
      const html = await response.text();
      const $ = cheerio.load(html);
      const textContent = $("body").text();

      if (!textContent || textContent.trim().length === 0) {
        throw new Error("Failed to extract text from the URL");
      }

      const { title, unfocusedSummary, focusedSummary } = await processFile(
        textContent,
        model,
      );

      const fileId = uuidv4();
      const newFile = {
        id: fileId,
        original_name: url,
        name: title,
        type: "link",
        date_uploaded: new Date(),
        summaries: [
          {
            id: uuidv4(),
            is_focused: false,
            content: unfocusedSummary,
            date_created: new Date(),
          },
          {
            id: uuidv4(),
            is_focused: true,
            content: focusedSummary,
            date_created: new Date(),
          },
        ],
      };

      const conversation = await Conversation.findOne({ id: conversationId });
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      conversation.files.push(newFile);
      conversation.last_updated = new Date();
      await conversation.save();

      return { name: title, id: fileId };
    } else {
      const tempFilePath = path.join(os.tmpdir(), uuidv4());
      const dest = fs.createWriteStream(tempFilePath);
      await new Promise((resolve, reject) => {
        response.body.pipe(dest);
        response.body.on("error", reject);
        dest.on("finish", resolve);
      });

      const file = {
        path: tempFilePath,
        originalname: path.basename(url),
        mimetype: contentType,
      };

      const result = await processUploadedFile(file, conversationId);
      return result;
    }
  } catch (error) {
    throw new Error(`Error processing uploaded link: ${error.message}`);
  }
}

async function processYoutubeLink(youtubeUrl, conversationId) {
  try {
    if (!ytdl.validateURL(youtubeUrl)) {
      throw new Error("Invalid YouTube URL");
    }

    console.log(`Processing YouTube video: ${youtubeUrl}`);

    const info = await ytdl.getInfo(youtubeUrl);
    console.log(`Got video info: ${JSON.stringify(info)}`);

    let captionsTrack =
      info.player_response.captions?.playerCaptionsTracklistRenderer?.captionTracks?.find(
        (track) => track.languageCode === "en",
      );

    if (!captionsTrack) {
      captionsTrack =
        info.player_response.captions?.playerCaptionsTracklistRenderer?.captionTracks?.find(
          (track) => ["en", "es", "fr", "de", "it", "pt", "nl", "ru", "zh"].includes(track.languageCode),
        );
      if (!captionsTrack) {
        throw new Error("No suitable captions found for the YouTube video");
      }
    }

    console.log(`Using captions track: ${JSON.stringify(captionsTrack)}`);

    const captionsResponse = await fetch(captionsTrack.baseUrl);
    if (!captionsResponse.ok) {
      throw new Error("Failed to fetch YouTube captions");
    }

    const captionsXml = await captionsResponse.text();
    const $ = cheerio.load(captionsXml, { xmlMode: true });
    const textContent = $("text")
      .map((i, el) => $(el).text())
      .get()
      .join(" ");

    if (!textContent || textContent.trim().length === 0) {
      throw new Error("Failed to extract text from the YouTube captions");
    }

    console.log(`Extracted text from captions: ${textContent}`);

    const { title, unfocusedSummary, focusedSummary } = await processFile(
      textContent,
      model,
    );

    console.log(`Got file metadata: ${JSON.stringify({ title, unfocusedSummary, focusedSummary })}`);

    const fileId = uuidv4();
    const newFile = {
      id: fileId,
      original_name: youtubeUrl,
      name: title,
      type: "video",
      date_uploaded: new Date(),
      summaries: [
        {
          id: uuidv4(),
          is_focused: false,
          content: unfocusedSummary,
          date_created: new Date(),
        },
        {
          id: uuidv4(),
          is_focused: true,
          content: focusedSummary,
          date_created: new Date(),
        },
      ],
    };

    const conversation = await Conversation.findOne({ id: conversationId });
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    conversation.files.push(newFile);
    conversation.last_updated = new Date();
    await conversation.save();

    console.log(`Saved new file: ${JSON.stringify(newFile)}`);

    return { name: title, id: fileId };
  } catch (error) {
    throw new Error(`Error processing YouTube link: ${error.message}`);
  }
}


module.exports = { processUploadedFile, processUploadedLink, processYoutubeLink };
