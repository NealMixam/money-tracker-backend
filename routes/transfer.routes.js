const express = require("express");
const router = express.Router();
const { transfer } = require("../controllers/transfer.controller");
const authenticate = require("../auth");

router.use(authenticate);
router.post("/transfer", transfer);

module.exports = router;
