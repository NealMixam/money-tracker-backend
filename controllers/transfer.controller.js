const pool = require("../db");

async function transfer(req, res) {
  const { fromAccountId, toAccountId, amount, description, date } = req.body;

  if (fromAccountId == null || toAccountId == null || amount == null) {
    return res
      .status(400)
      .json({ error: "fromAccountId, toAccountId and amount are required" });
  }

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  if (fromAccountId === toAccountId) {
    return res
      .status(400)
      .json({ error: "Source and destination accounts must be different" });
  }

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

    const fromRes = await client.query(
      "SELECT id, user_id FROM accounts WHERE id = $1 FOR UPDATE",
      [fromAccountId],
    );
    const toRes = await client.query(
      "SELECT id, user_id FROM accounts WHERE id = $1 FOR UPDATE",
      [toAccountId],
    );

    if (fromRes.rowCount === 0) {
      throw new Error("Source account not found");
    }
    if (toRes.rowCount === 0) {
      throw new Error("Destination account not found");
    }

    const fromAcc = fromRes.rows[0];
    const toAcc = toRes.rows[0];

    if (
      fromAcc.user_id !== req.user.userId ||
      toAcc.user_id !== req.user.userId
    ) {
      throw new Error(
        "Unauthorized: one or both accounts do not belong to you",
      );
    }

    const fromBalance = await getAccountBalance(fromAccountId, client);
    if (fromBalance < amt) {
      throw new Error("Insufficient funds");
    }

    const trDesc = description ?? "";
    const trDate = date ?? new Date().toISOString().slice(0, 10);

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
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
}

module.exports = { transfer };
