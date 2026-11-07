const pool = require("../db");
const {isValidAmount} = require("../validation/amount");
const {
  isValidAccountId,
  isValidDescription,
  isValidDate,
} = require("../validation/transaction");

async function createExpense(req, res) {
  if (req.body == null || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "Request body must be a JSON object" })
  }

  const { accountId, amount, description, date } = req.body;

  const userId = req.user.userId;

  if (accountId == null || amount == null) {
    res.status(400).json({ error: "AccountId and amount are required" });
    return;
  }

  if (!isValidAccountId(accountId)) {
    return res.status(400).json({ error: "AccountId must be a positive integer" });
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

  const client = await pool.connect();

  try {
    const accRes = await client.query(
      "SELECT id, user_id FROM accounts WHERE id = $1 FOR UPDATE",
      [accountId],
    );

    if (accRes.rowCount === 0) {
      return res.status(404).json({ error: "Account not found" });
    }
    if (accRes.rows[0].user_id !== userId) {
      return res.status(403).json({ error: "Account does not belong to you" });
    }

    const result = await client.query(
      `INSERT INTO transactions (account_id, user_id, type, amount, description, date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, amount, date`,
      [accountId, userId, "expense", amt, trDesc, trDate],
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
}

module.exports = { createExpense };
