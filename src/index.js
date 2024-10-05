import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import "@catppuccin/highlightjs/css/catppuccin-mocha.css";
import markdownItHighlightjs from "markdown-it-highlightjs";
import "./css/input.css";
import { formatCitation } from "../utils/citation";

const md = MarkdownIt({ typographer: false, linkify: false, html: false })
  .use(markdownItHighlightjs)
  .use(require("markdown-it-katex"), {
    throwOnError: false,
    errorColor: " #cc0000",
  });

// Custom code block renderer to use highlight.js
md.renderer.rules.code_block = (tokens, idx) => {
  const token = tokens[idx];
  const languageClass = token.info ? token.info.trim() : ""; // Get the language class
  const highlightedCode = languageClass
    ? hljs.highlight(languageClass, token.content).value
    : hljs.highlightAuto(token.content).value; // Highlight the code based on the language class or auto-detect
  return `<pre><code class="${languageClass}">${highlightedCode}</code></pre>`;
};

// Constants

const apiEndpoints = {
  conversation: {
    create: "/api/conversation/create",
    id: (id) => `/api/conversation/${id}`,
    messages: (id) => `/api/conversation/messages/${id}`,
    exists: (id) => `/api/conversation/exists/${id}`,
    chat: {
      title: (id) => `/api/conversation/chat/title/${id}`,
      response: (id) => `/api/conversation/chat/response/${id}`,
    },
    upload: {
      file: (id) => `/api/content/upload/file/${id}`,
      url: (id) => `/api/content/upload/link/${id}`,
      video: (id) => `/api/content/upload/video/${id}`,
    },
    focus: (id, fileId) => `/api/content/focus/${id}/${fileId}`,
    rename: (id, fileId) => `/api/content/rename/${id}/${fileId}`,
  },
};

const fromID = (id) => document.getElementById(id);

const _sidebar = fromID("sidebar");

const _messagesView = fromID("messages");
const _chatTitle = fromID("chat-title");

const _queryBar = fromID("input");
const _sendButton = fromID("send-button");

const _newChatButton = fromID("new-chat");

const _uploadButton = fromID("upload-button");
const _uploadDropArea = fromID("upload-drop-area");
const _uploadFileInput = fromID("upload-file-input");
const _uploadMenu = fromID("upload-menu");

const _uploadFileComputer = fromID("upload-file-computer-button");
const _uploadFileUrl = fromID("upload-file-url-button");
const _uploadYoutube = fromID("upload-youtube-button");

const _uploadUrlInput = fromID("upload-url-input");
const _uploadUrlSubmit = fromID("upload-url-submit");

const _focusButton = fromID("focus-button");
const _focusMenu = fromID("focus-menu");

const _focusCount = fromID("focus-count");
const _focusEd = fromID("focus-ed");
const _focusIcon = fromID("focus-button-icon");

function processRenderedContent(content, tagNames, tagTypes) {
  for (const tag of tagNames) {
    const tagName = tag;
    const tagType = tagTypes[tagNames.indexOf(tag)] || "div";

    content = content
      .replace(
        new RegExp(`&lt;${tagName}([\\s\\S]*?)&gt;`, "gi"),
        (match, attrs) => {
          const attributes = attrs ? modifyAttributes(attrs) : "";
          return `<${tagType} class="${tagName.replace(/_/g, "-").toLowerCase()}"${attributes}>`;
        },
      )
      .replace(new RegExp(`&lt;/${tagName}&gt;`, "gi"), `</${tagType}>`);
  }

  return content;
}

// Helper function to parse, modify, and reconstruct attributes
function modifyAttributes(attrString) {
  // Decode any HTML entities in the attributes
  const decodedAttrs = decodeHTMLEntities(attrString);
  // Regular expression to match attributes and their values
  const attrRegex = /(\S+)=["']?((?:.(?!["']?\s+(?:\S+)=|[>"']))+.)["']?/g;
  let result;
  let modifiedAttrs = "";
  // Iterate over all matched attributes
  while ((result = attrRegex.exec(decodedAttrs)) !== null) {
    let attrName = result[1];
    let attrValue = result[2];
    // Prefix attribute name with data-
    attrName = `data-${attrName}`;
    // Reconstruct the attribute string
    modifiedAttrs += ` ${attrName}="${attrValue}"`;
  }
  return modifiedAttrs;
}

// Helper function to decode HTML entities
function decodeHTMLEntities(str) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = str;
  return textarea.value;
}

let conversationId = sessionStorage.getItem("conversationId") || null;

async function createNewConversation() {
  const response = await fetch(apiEndpoints.conversation.create, {
    method: "POST",
  });
  const { id: newId } = await response.json();
  conversationId = newId;
  sessionStorage.setItem("conversationId", conversationId);
  // Update the URL to include the new conversation ID
  window.history.replaceState(null, null, `/chat/${conversationId}`);
}

async function initializeConversation(id = null) {
  try {
    if (!id) {
      // Create a new conversation
      await createNewConversation();
    } else {
      // Check to make sure the conversation exists
      const checkResponse = await fetch(apiEndpoints.conversation.exists(id));
      const { exists } = await checkResponse.json();
      if (!exists) {
        // Conversation does not exist, create a new one
        await createNewConversation();
        await loadMessages();
        renderFocusMenu(id);
      } else {
        // Conversation exists, load the messages and name
        sessionStorage.setItem("conversationId", id);
        conversationId = id;
        await loadMessages();
        renderFocusMenu(id);
      }
    }
  } catch (error) {
    console.error("Error initializing conversation:", error);
    alert("Failed to initialize conversation. Please try again.");
  }
}

const urlConversationId = getConversationIdFromURL();
initializeConversation(urlConversationId);

window.addEventListener("popstate", () => {
  const urlConversationId = getConversationIdFromURL();
  initializeConversation(urlConversationId);
});

function setFollowupEvents() {
  document.querySelectorAll(".followup").forEach((followupElement) => {
    if (!followupElement.onclick) {
      followupElement.onclick = () => {
        _queryBar.value = followupElement.innerText;
        _queryBar.focus();
      };
    }
  });
}

_sendButton.addEventListener("click", async (e) => {
  e.preventDefault();

  let trimmedQuery = _queryBar.value.trim();

  if (!trimmedQuery) {
    return;
  }

  const query = document.createElement("div");

  query.innerText = trimmedQuery;
  query.classList.add("user-message", "prose", "prose-white");
  _messagesView.appendChild(query);
  _queryBar.value = "";
  _queryBar.dispatchEvent(new Event("input"));
  // Save the user message
  await saveMessage("user", query.innerText);

  const reply = document.createElement("div");
  reply.classList.add("assistant-message", "prose", "prose-white");
  _messagesView.appendChild(reply);
  reply.innerHTML = "";
  await processResponse(reply);

  setFollowupEvents();
});

async function processResponse(reply) {
  const response = await fetch(
    apiEndpoints.conversation.chat.response(conversationId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
  );

  const reader = response.body.getReader();
  const textDecoder = new TextDecoder();

  let output = "";
  let renderedContent = "";

  let timeoutId;

  const startTimeout = () => {
    clearTimeout(timeoutId); // Clear previous timeout before starting a new one
    timeoutId = setTimeout(() => {
      reply.innerText = "The AI took too long to respond. Please try again.";
      throw new Error("Response timed out");
    }, 60000);
  };

  // Start the initial timeout
  startTimeout();

  while (true) {
    try {
      // Restart the timeout before awaiting a new chunk.
      startTimeout();

      const { done, value } = await reader.read();

      // Clear the timeout once the value is received successfully
      clearTimeout(timeoutId);

      if (done) break;

      let chunks = textDecoder.decode(value);

      for (let chunk of chunks.split("<__sqnd__>")) {
        if (!chunk) {
          continue;
        }

        chunk = JSON.parse(chunk);

        if (chunk.type == "content") {
          output += chunk.data;

          renderedContent = processRenderedContent(
            md.render(output),
            ["followups", "followup", "source"],
            ["div", "div", "span"],
          );

          updateElement(reply, renderedContent);

          citationSetup(reply);
        }

        if (chunk.type == "loader") {
          // Add loader
          const loaderParent = document.createElement("p");
          const loader = document.createElement("em");
          loader.classList.add("generate_loader");
          loader.innerText = chunk.data;
          loaderParent.appendChild(loader);

          reply.innerHTML = "";

          // Add the loader to the message
          reply.appendChild(loaderParent);
        }

        if (chunk.type == "tool_call") {
          await processResponse(reply);
          return;
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Clear timeout after loop finishes
  clearTimeout(timeoutId);

  if (_chatTitle.innerText == "New Chat") {
    const controller = new AbortController();
    const { signal } = controller;

    const promise = fetch(
      apiEndpoints.conversation.chat.title(conversationId),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: output }),
        signal,
      },
    ).then((response) => response.json());

    _newChatButton.addEventListener("click", () => {
      controller.abort();
    });

    try {
      const data = await promise;
      _chatTitle.innerText = data.response;
      // set window title
      document.title = `${data.response} | Stratus AI`;
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Error:", error);
      }
    }
  }
}

/**
 * Loads the messages from the conversation and renders them to the page.
 * @async
 */
async function loadMessages() {
  try {
    const response = await fetch(apiEndpoints.conversation.id(conversationId));
    const { messages, name } = await response.json();

    _chatTitle.innerText = name;

    document.title = `${name} | Stratus AI`;

    if (messages.length === 0) return; // No previous messages

    const messageElements = messages
      .map((message) => {
        // Pass if message.role is tool are if assistant message contains a tool_calls array with at least one element
        if (
          !message ||
          message.role === "tool" ||
          message.tool_calls?.length > 0
        )
          return;

        const messageElement = document.createElement("div");
        if (message.role === "user" && message.content) {
          // Render the user's message as plain text
          messageElement.innerText = message.content;
        } else if (message.role === "assistant" && message.content) {
          // Render the assistant's message with markdown and followup blocks
          try {
            messageElement.innerHTML = processRenderedContent(
              md.render(message.content),
              ["followups", "followup", "source"],
              ["div", "div", "span"],
            );

            // find all .source elements and set inner text to data-sname value
            // Assume 'formatCitation' function is defined elsewhere as per previous discussions
            citationSetup(messageElement);
          } catch (error) {
            console.error("Error rendering message:", error);
            messageElement.innerText = "Error rendering message";
          }
        }
        // Add the message to the page
        messageElement.classList.add(
          message.role === "user" ? "user-message" : "assistant-message",
          "prose",
          "prose-white",
        );
        return messageElement;
      })
      .filter((element) => element && element.innerHTML !== "");

    if (messageElements.length > 0) {
      _messagesView.append(...messageElements);
    }

    // Add click events to the followup blocks
    setFollowupEvents();
  } catch (error) {
    console.error("Error loading messages:", error);
  }
}

function citationSetup(messageElement) {
  const sourceElements = messageElement.querySelectorAll(".source");
  sourceElements.forEach((element) => {
    element.innerText = element.dataset.sname;

    element.addEventListener("contextmenu", (event) => {
      event.preventDefault(); // Prevent the default context menu

      // Retrieve citation data
      const authors = [];
      let index = 1;
      while (true) {
        const firstName = element.getAttribute(
          `data-sauthor${index}-first-name`,
        );
        const lastName = element.getAttribute(`data-sauthor${index}-last-name`);
        if (!firstName && !lastName) break;
        authors.push({ firstName, lastName });
        index++;
      }

      const citation = {
        authors: authors,
        year: element.getAttribute("data-syear"),
        month: element.getAttribute("data-smonth"),
        day: element.getAttribute("data-sday"),
        title: element.getAttribute("data-sname"),
        subtitle: element.getAttribute("data-ssubtitle"),
        publisher: element.getAttribute("data-spublisher"),
        url: element.getAttribute("data-surl"),
        siteName: element.getAttribute("data-ssite-name"),
        publicationDate: element.getAttribute("data-spublication-date"),
        accessDate: element.getAttribute("data-saccess-date"),
      };

      // Generate formatted citations
      const formattedCitations = formatCitation(citation);

      // Create the custom context menu
      const menu = document.createElement("div");
      menu.classList.add("custom-context-menu");

      // Citation styles
      const styles = ["APA", "MLA", "Chicago"];

      styles.forEach((style) => {
        const menuItem = document.createElement("div");
        menuItem.classList.add("context-menu-item");
        menuItem.innerText = `${style}`;
        menuItem.addEventListener("click", () => {
          const citationText = formattedCitations[style.toLowerCase()];
          copyToClipboard(citationText);

          // Clean up the menu
          document.body.removeChild(menu);
        });
        menu.appendChild(menuItem);
      });

      // Add the custom menu to the body
      document.body.appendChild(menu);

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const boundingBox = menu.getBoundingClientRect();
      const menuWidth = boundingBox.width;
      const menuHeight = boundingBox.height;
      const x = event.clientX;
      const y = event.clientY;

      if (x + menuWidth > viewportWidth) {
        menu.style.left = `${x - menuWidth}px`;
      } else {
        menu.style.left = `${x}px`;
      }

      if (y + menuHeight > viewportHeight) {
        menu.style.top = `${y - menuHeight}px`;
      } else {
        menu.style.top = `${y}px`;
      }

      // Remove the menu when clicking elsewhere
      // Look for edge cases where the menu is not a child of body
      function cleanUpMenu() {
        if (menu.parentNode === document.body) {
          if (menu && menu.parentNode === document.body) {
            document.body.removeChild(menu);
          }
        }
        document.removeEventListener("click", cleanUpMenu);
      }

      document.addEventListener("click", cleanUpMenu, { capture: true });
      document.addEventListener("contextmenu", cleanUpMenu, { capture: true });
      document.addEventListener("scroll", cleanUpMenu, { capture: true });
      window.addEventListener("resize", cleanUpMenu, { capture: true });
    });

    element.addEventListener("click", (event) => {
      // Open the link in a new tab
      window.open(element.getAttribute("data-surl"), "_blank");
    });
  });

  // Function to copy text to clipboard
  function copyToClipboard(text) {
    // Use the Clipboard API if available
    if (navigator.clipboard && window.isSecureContext) {
      // navigator.clipboard.writeText returns a promise
      navigator.clipboard.writeText(text).catch((err) => {
        console.error("Could not copy text: ", err);
      });
    } else {
      // Use a fallback method
      const textArea = document.createElement("textarea");
      textArea.value = text;
      // Avoid scrolling to bottom
      textArea.style.position = "fixed";
      textArea.style.top = "-9999px";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand("copy");
      } catch (err) {
        console.error("Could not copy text: ", err);
      }

      document.body.removeChild(textArea);
    }
  }
}

async function saveMessage(role, content) {
  const message = {
    role,
    content,
    date_created: new Date().toISOString(),
  };

  try {
    const response = await fetch(
      apiEndpoints.conversation.messages(conversationId),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to save message");
    }
  } catch (error) {
    console.error("Error saving message:", error);
    alert("Failed to send your message. Please try again.");
    throw error; // Rethrow to handle in caller
  }
}

document.getElementById("input").addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    if (event.shiftKey) {
      event.preventDefault();
      const textarea = event.target;
      const cursorPos = textarea.selectionStart;
      textarea.value =
        textarea.value.substring(0, cursorPos) +
        "\n" +
        textarea.value.substring(cursorPos);
      textarea.setSelectionRange(cursorPos + 1, cursorPos + 1);
    } else if (this.value.trim() !== "") {
      event.preventDefault();
      this.form.querySelector('button[type="submit"]').click();
    }
  }
});

function updateElement(element, html) {
  const tempElement = document.createElement("div");
  tempElement.innerHTML = html;

  const newChildren = Array.from(tempElement.children);
  const newChildrenLength = newChildren.length;

  const oldChildren = Array.from(element.children);
  const oldChildrenLength = oldChildren.length;

  for (let i = 0; i < Math.min(oldChildrenLength, newChildrenLength); i++) {
    const oldChild = oldChildren[i];
    const newChild = newChildren[i];
    if (oldChild.outerHTML !== newChild.outerHTML) {
      element.replaceChild(newChild, oldChild);
    }
  }

  if (oldChildrenLength > newChildrenLength) {
    for (let i = newChildrenLength; i < oldChildrenLength; i++) {
      element.removeChild(element.lastChild);
    }
  } else {
    for (let i = oldChildrenLength; i < newChildrenLength; i++) {
      element.appendChild(newChildren[i]);
    }
  }
}

_newChatButton.addEventListener("click", async () => {
  sessionStorage.removeItem("conversationId");
  conversationId = null;
  await initializeConversation();
  _chatTitle.innerText = "New Chat";
  document.title = `New Chat | Stratus AI`;
  _queryBar.value = "";
  _queryBar.dispatchEvent(new Event("input"));
  _queryBar.focus();
  _queryBar.select();
  _messagesView.innerHTML = "";
  renderFocusMenu(conversationId);
});

_queryBar.addEventListener("input", () => {
  // if the query bar is empty, hide the send button
  if (_queryBar.value.trim() == "") {
    _sendButton.classList.add("opacity-0", "scale-0");
    _sendButton.classList.remove("opacity-100", "scale-100");
  } else {
    _sendButton.classList.add("opacity-100", "scale-100");
    _sendButton.classList.remove("opacity-0", "scale-0");
  }
});

// run input event on load
_queryBar.dispatchEvent(new Event("input"));

_uploadButton.addEventListener("click", () => {
  _uploadMenu.classList.toggle("show-menu");
  _focusMenu.classList.remove("show-menu");
  if (!_uploadMenu.classList.contains("show-menu")) {
    _uploadMenu.classList.remove("show-input");
    _uploadMenu.classList.remove("show-drop-area");
    _queryBar.focus();
  }
});

_focusButton.addEventListener("click", () => {
  _focusMenu.classList.toggle("show-menu");
  _uploadMenu.classList.remove("show-menu");
  _uploadMenu.classList.remove("show-input");
  _uploadMenu.classList.remove("show-drop-area");
  if (!_focusMenu.classList.contains("show-menu")) {
    _queryBar.focus();
  }
});

_uploadFileComputer.addEventListener("click", function () {
  _uploadMenu.classList.add("show-drop-area");
});

var linkFor = "file";

_uploadFileUrl.addEventListener("click", function () {
  linkFor = "url";
  _uploadMenu.classList.add("show-input");
  _uploadUrlInput.focus();
  _uploadUrlInput.value = "";
  _uploadUrlInput.placeholder = "Link to content";
  _uploadUrlSubmit.disabled = true;
});

_uploadYoutube.addEventListener("click", function () {
  linkFor = "video";
  _uploadMenu.classList.add("show-input");
  _uploadUrlInput.focus();
  _uploadUrlInput.value = "";
  _uploadUrlInput.placeholder = "Link to video";
  _uploadUrlSubmit.disabled = true;
});

_uploadUrlInput.addEventListener("input", function () {
  console.log(linkFor);

  if (linkFor == "url") {
    _uploadUrlSubmit.disabled = !this.value.match(
      /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)$/i,
    );
  } else if (linkFor == "video") {
    _uploadUrlSubmit.disabled = !this.value.match(
      /^https?:\/\/(www\.)?(youtube\.com\/(watch\?(.*&)?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(\S*)?$/,
    );
  }
});

_uploadUrlSubmit.addEventListener("click", function () {
  uploadContent(_uploadUrlInput.value);
  _uploadUrlInput.blur();
  _uploadMenu.classList.remove("show-input");
  _uploadMenu.classList.remove("show-menu");
});

_uploadDropArea.addEventListener("dragover", (event) => {
  event.preventDefault();
  _uploadDropArea.classList.add("hover");
});

_uploadDropArea.addEventListener("dragleave", () => {
  _uploadDropArea.classList.remove("hover");
});

_uploadDropArea.addEventListener("drop", (event) => {
  event.preventDefault();
  _uploadDropArea.classList.remove("hover");
  const files = event.dataTransfer.files;
  _uploadMenu.classList.remove("show-menu");
  _uploadMenu.classList.remove("show-drop-area");
  handleFiles(files);
  _uploadFileInput.value = "";
});

_uploadDropArea.addEventListener("click", () => {
  _uploadFileInput.click();
});

_uploadFileInput.addEventListener("change", (event) => {
  const files = event.target.files;
  _uploadMenu.classList.remove("show-menu");
  _uploadMenu.classList.remove("show-drop-area");
  handleFiles(files);
});

// check visibility of both menus every 100ms, if either menu can be seen, during transition or not, add/remove menu-overflow-control class to both
setInterval(() => {
  if (
    _uploadMenu.getBoundingClientRect().height > 0 ||
    _focusMenu.getBoundingClientRect().height > 0
  ) {
    _uploadMenu.classList.add("menu-overflow-control");
    _focusMenu.classList.add("menu-overflow-control");
  } else {
    _uploadMenu.classList.remove("menu-overflow-control");
    _focusMenu.classList.remove("menu-overflow-control");
  }
}, 100);

function handleFiles(files) {
  const promises = [];
  for (const file of files) {
    promises.push(uploadContent(file));
  }
  Promise.allSettled(promises);
}

async function uploadContent(content) {
  const formData = new FormData();
  let name;

  // Determine if the content is a File or a URL string
  if (content instanceof File) {
    formData.append("file", content);
    name =
      content.name.length > 27
        ? content.name.slice(0, 25) + "..."
        : content.name;
  } else if (typeof content === "string") {
    formData.append("url", content);
    name = content.length > 27 ? content.slice(0, 25) + "..." : content;
  } else {
    throw new Error("Invalid content type");
  }

  // Create the status bar UI element
  const statusBar = document.createElement("div");
  statusBar.classList.add(
    "flex",
    "items-center",
    "gap-2",
    "rounded-xl",
    "border",
    "border-zinc-800",
    "bg-zinc-900",
    "p-1.5",
    "pr-3",
  );

  const progress = document.createElement("div");
  progress.classList.add(
    "flex",
    "items-center",
    "justify-center",
    "rounded-md",
    "p-1",
  );

  const radialProgress = document.createElement("div");
  radialProgress.classList.add("loading", "text-xs", "text-zinc-400");

  const contentName = document.createElement("div");
  contentName.classList.add("text-xs", "font-medium", "text-zinc-400");
  contentName.innerText = name;

  const status = document.createElement("div");
  status.classList.add("text-xs", "text-zinc-500");
  status.innerText = "Studying";

  const textGroup = document.createElement("div");
  textGroup.classList.add("flex", "flex-col", "items-start", "justify-center");
  textGroup.appendChild(contentName);
  textGroup.appendChild(status);

  statusBar.appendChild(progress);
  progress.appendChild(radialProgress);
  statusBar.appendChild(textGroup);

  document.getElementById("upload-status-bar").appendChild(statusBar);

  try {
    let response;
    console.log(formData, content);
    if (content instanceof File) {
      console.log("File");
      response = await fetch(
        apiEndpoints.conversation.upload.file(conversationId),
        {
          method: "POST",
          body: formData,
        },
      );
    } else if (isYoutubeLink(content)) {
      console.log("Youtube Link");
      response = await fetch(
        apiEndpoints.conversation.upload.video(conversationId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: content }),
        },
      );
    } else {
      console.log("URL");
      response = await fetch(
        apiEndpoints.conversation.upload.url(conversationId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: content }),
        },
      );
    }

    function isYoutubeLink(url) {
      const regex =
        /^https?:\/\/(www\.)?(youtube\.com\/(watch\?(.*&)?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(\S*)?$/;
      const match = url.match(regex);
      return match !== null;
    }

    if (!response.ok) {
      throw new Error("Failed to upload content");
    }

    // Update status to "Studied" upon success
    status.innerText = "Studied";

    // Optionally, remove the status bar after a delay
    setTimeout(() => {
      statusBar.remove();
      _focusMenu.classList.add("show-menu");
    }, 200);

    // Refresh the focus menu to reflect the new content
    renderFocusMenu(conversationId);
  } catch (error) {
    console.error("Error uploading content:", error);
    alert("Failed to upload content. Please try again.");

    // Update status to "Failed to study" upon error
    status.innerText = "Failed to study";

    setTimeout(() => {
      statusBar.remove();
    }, 2000);
  }
}

async function renderFocusMenu(conversationId) {
  const response = await fetch(apiEndpoints.conversation.id(conversationId));
  const conversation = await response.json();

  _focusMenu.innerHTML = "";
  conversation.files.forEach((file) => {
    const button = document.createElement("div");
    const buttonName = document.createElement("span");
    let extension = null;
    const filename = file.name;
    if (filename.includes(".")) {
      const split = filename.split(".");
      buttonName.innerText = split.slice(0, -1).join(".");
      extension = "." + split[split.length - 1];
    } else {
      buttonName.innerText = filename;
    }
    buttonName.classList.add("file-name");
    if (extension) {
      const buttonExtension = document.createElement("span");
      buttonExtension.innerText = extension;
      buttonExtension.classList.add("file-extension");
      button.appendChild(buttonExtension);
    }

    // check if file is new
    if (new Date() - new Date(file.date_uploaded) < 20 * 1000) {
      buttonName.classList.add("new");
      button.classList.add("new");
    }
    button.appendChild(buttonName);
    button.classList.add("checkbox-button");
    button.title = file.original_name;
    button.type = "button";
    // check if file is focused
    if (conversation.focused_files.includes(file.id)) {
      button.classList.add("selected");
    }
    button.addEventListener("click", async () => {
      const { focused, focused_files } = await fetch(
        apiEndpoints.conversation.focus(conversation.id, file.id),
        {
          method: "POST",
        },
      ).then((response) => response.json());

      if (focused) {
        button.classList.add("selected");
      } else {
        button.classList.remove("selected");
      }

      if (focused_files.length === 0) {
        _focusEd.classList.add("hidden");
        _focusCount.classList.add("hidden");
        _focusIcon.setAttribute("fill", "none");
      } else {
        _focusEd.classList.remove("hidden");
        _focusCount.classList.remove("hidden");
        _focusIcon.setAttribute("fill", "currentColor");
        _focusCount.innerText = focused_files.length;
      }
    });
    _focusMenu.appendChild(button);
  });

  // if there are no files, add a "No files" span
  if (conversation.files.length === 0) {
    const noFilesSpan = document.createElement("span");
    noFilesSpan.innerText = "There's no knowledge to study";
    noFilesSpan.classList.add("no-files-found");
    _focusMenu.appendChild(noFilesSpan);

    // add button to open upload menu
    const uploadButton = document.createElement("button");
    uploadButton.innerText = "Upload knowledge";
    uploadButton.title = "Upload knowledge";
    uploadButton.classList.add(
      "checkbox-button",
      "flex",
      "items-center",
      "justify-center",
    );
    uploadButton.type = "button";
    uploadButton.addEventListener("click", () => {
      _uploadMenu.classList.add("show-menu");
      _uploadMenu.classList.remove("show-drop-area");
      _uploadMenu.classList.remove("show-input");
      _focusMenu.classList.remove("show-menu");
    });
    _focusMenu.appendChild(uploadButton);
  }

  if (conversation.focused_files.length === 0) {
    _focusEd.classList.add("hidden");
    _focusCount.classList.add("hidden");
    _focusIcon.setAttribute("fill", "none");
  } else {
    _focusEd.classList.remove("hidden");
    _focusCount.classList.remove("hidden");
    _focusIcon.setAttribute("fill", "currentColor");
    _focusCount.innerText = conversation.focused_files.length;
  }
}

// Function to extract conversation ID from URL
function getConversationIdFromURL() {
  const pathSegments = window.location.pathname.split("/");
  if (pathSegments.length === 3 && pathSegments[1] === "chat") {
    return pathSegments[2];
  }
  return null;
}

window.addEventListener("mousemove", (event) => {
  if (event.clientX < 50) {
    _sidebar.classList.add("hover");
  } else {
    _sidebar.classList.remove("hover");
  }
});
