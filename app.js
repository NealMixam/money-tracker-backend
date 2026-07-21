const express = require("express");
const authRoutes = require("./routes/auth.routes");
const transferRoutes = require("./routes/transfer.routes");
const accountRoutes = require("./routes/account.routes");

const app = express();
app.use(express.json());
app.use("/", authRoutes);
app.use("/", transferRoutes);
app.use("/", accountRoutes);

module.exports = app;
