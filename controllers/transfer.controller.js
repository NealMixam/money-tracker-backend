const pool = require("../db");
const { isValidAmount } = require("../validation/amount");

const {
  isValidAccountId,
  isValidDescription,
  isValidDate,
} = require("../validation/transaction");

async function transfer(req, res) {
  if (req.body == null || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "Request body must be a JSON object" })
  }

  const { fromAccountId, toAccountId, amount, description, date } = req.body;

  if (fromAccountId == null || toAccountId == null || amount == null) {
    return res
      .status(400)
      .json({ error: "fromAccountId, toAccountId and amount are required" });
  }

  if (
      !isValidAccountId(fromAccountId) ||
      !isValidAccountId(toAccountId)
  ) {
    return res.status(400).json({
      error: "fromAccountId and toAccountId must be positive integers",
    });
  }

  if (fromAccountId === toAccountId) {
    return res
      .status(400)
      .json({ error: "Source and destination accounts must be different" });
  }

  if (!isValidAmount(amount)) {
    return res.status(400).json({ error: "Amount must be a positive decimal string with at most two decimal places and must not exceed 9999999999.99" });
  }

  const amt = Number(amount);

  if(!isValidDescription(description)) {
    return res.status(400).json({ error: "Description must be a string of at most 1000 characters" });
  }

  if (!isValidDate(date)) {
    return res.status(400).json({ error: "Invalid date" });
  }

  const trDesc = description ?? "";
  const trDate = date ?? new Date().toISOString().slice(0, 10);

  async function getAccountBalance(accountId, client) {
    const res = await client.query(
      `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END), 0) AS balance
       FROM transactions WHERE account_id = $1`,
      [accountId],
    );
    return Number(res.rows[0].balance);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const accountIds = [fromAccountId, toAccountId].sort((a, b) => a - b);

    const accounts = [];

    for (const accountId of accountIds) {
      const result = await client.query(
          "SELECT id, user_id, currency FROM accounts WHERE id = $1 FOR UPDATE",
          [accountId],
      );

      if (result.rowCount > 0) {
        accounts.push(result.rows[0]);
      }
    }

    const fromAcc = accounts.find((account) => account.id === fromAccountId);
    const toAcc = accounts.find((account) => account.id === toAccountId);

    if (!fromAcc) {
      throw new Error("Source account not found");
    }

    if (!toAcc) {
      throw new Error("Destination account not found");
    }

    if (
      fromAcc.user_id !== req.user.userId ||
      toAcc.user_id !== req.user.userId
    ) {
      throw new Error(
        "Unauthorized: one or both accounts do not belong to you",
      );
    }

    if (fromAcc.currency !== toAcc.currency) {
      throw new Error("Accounts must have the same currency");
    }

    const fromBalance = await getAccountBalance(fromAccountId, client);
    if (fromBalance < amt) {
      throw new Error("Insufficient funds");
    }

    await client.query(
      "INSERT INTO transactions (account_id, user_id, type, amount, description, date) VALUES ($1, $2, $3, $4, $5, $6)",
      [fromAccountId, req.user.userId, "expense", amt, trDesc, trDate],
    );

    await client.query(
      "INSERT INTO transactions (account_id, user_id, type, amount, description, date) VALUES ($1, $2, $3, $4, $5, $6)",
      [toAccountId, req.user.userId, "income", amt, trDesc, trDate],
    );

    await client.query("COMMIT");
    return res.status(200).json({ message: "Transfer completed" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Transfer error:", err);

    if (err.message === "Insufficient funds") {
      return res.status(400).json({ error: "Insufficient funds" });
    }
    if (
      err.message.startsWith("Source account not found") ||
      err.message.startsWith("Destination account not found")
    ) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.startsWith("Unauthorized")) {
      return res.status(403).json({ error: err.message });
    }
    if (err.message.startsWith("Accounts must have the same currency")) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
}

module.exports = { transfer };
