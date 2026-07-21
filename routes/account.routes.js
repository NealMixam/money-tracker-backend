const express = require("express");
const router = express.Router();
const {
  createAccount,
  listAccounts,
} = require("../controllers/account.controller");
const authenticate = require("../auth");

router.use(authenticate);

router.post("/account", createAccount);
router.get("/accounts", listAccounts);

module.exports = router;
