const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const mammoth = require("mammoth");
const pdfReader = require("pdfreader");
const xml2js = require("xml2js");
const YAML = require("yamljs");

async function extractTextFromFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const filePath = file.path;

  switch (ext) {
    case ".pdf":
      return new Promise((resolve, reject) => {
        const text = [];
        new pdfReader.PdfReader()
          .parseFileItems(filePath, { combineText: true })
          .on("text", (item) => text.push(item.text))
          .on("end", () => resolve(text.join("\n")))
          .on("error", reject);
      });

    case ".docx":
    case ".doc":
      return (await mammoth.extractRawText({ path: filePath })).value;

    case ".txt":
    case ".md":
    case ".rtf":
      return fs.readFileSync(filePath, "utf8");

    case ".csv":
      return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on("data", (data) => results.push(data))
          .on("end", () => resolve(JSON.stringify(results, null, 2)))
          .on("error", reject);
      });

    case ".json":
      return JSON.stringify(
        JSON.parse(fs.readFileSync(filePath, "utf8")),
        null,
        2,
      );

    case ".xml":
      return new Promise((resolve, reject) => {
        const parser = new xml2js.Parser();
        fs.readFile(filePath, (err, data) => {
          if (err) reject(err);
          parser.parseString(data, (err, result) => {
            if (err) reject(err);
            resolve(JSON.stringify(result, null, 2));
          });
        });
      });

    case ".yaml":
    case ".yml":
      return JSON.stringify(
        YAML.load(fs.readFileSync(filePath, "utf8")),
        null,
        2,
      );

    default:
      // For code files and other text-based formats
      return fs.readFileSync(filePath, "utf8");
  }
}

module.exports = { extractTextFromFile };
