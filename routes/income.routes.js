const express = require("express");
const router = express.Router();
const { createIncome } = require("../controllers/income.controller");
const authenticate = require("../auth");

router.use(authenticate);
router.post("/income", createIncome);

module.exports = router;
