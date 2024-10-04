const multer = require("multer");
const path = require("path");

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions =
      /\.(pdf|doc|docx|txt|rtf|csv|json|xml|yaml|yml|html?|css|scss|sass|js|jsx?|ts|tsx?|php|py|java|c|cpp|h|hpp|rb|go|sh|bat|pl|md|swift|kt|scala|rs|dart|sql)$/i;
    if (!allowedExtensions.test(path.extname(file.originalname))) {
      return cb(new Error("Unsupported file type"), false);
    }
    cb(null, true);
  },
});

module.exports = upload;
