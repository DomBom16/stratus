const express = require("express");
const router = express.Router();
const toolController = require("../controllers/toolController");

router.post("/call", toolController.handleFunctionCall);

module.exports = router;
