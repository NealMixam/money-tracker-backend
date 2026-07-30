const express = require("express");
const cors = require('cors')
const authRoutes = require("./routes/auth.routes");
const transferRoutes = require("./routes/transfer.routes");
const accountRoutes = require("./routes/account.routes");
const incomeRoutes = require("./routes/income.routes");
const expenseRoutes = require("./routes/expense.routes");

const app = express();
app.use(cors({
  origin: 'http://localhost:5173',
}))
app.use(express.json());
app.use("/", authRoutes);
app.use("/", transferRoutes);
app.use("/", accountRoutes);
app.use("/", incomeRoutes);
app.use("/", expenseRoutes);

module.exports = app;
