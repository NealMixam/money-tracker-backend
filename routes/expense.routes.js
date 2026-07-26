const express = require("express");
const router = express.Router();
const { createExpense } = require("../controllers/expense.controller");
const authenticate = require("../auth");

router.use(authenticate);
router.post("/expense", createExpense);

module.exports = router;
