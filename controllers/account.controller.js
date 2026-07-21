const pool = require("../db");
const authenticate = require("../auth");

async function createAccount(req, res) {
  const { title, currency } = req.body;
  const userId = req.user.userId;

  if (!title || !currency) {
    return res.status(400).json({ error: "title and currency are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO accounts (user_id, title, currency, created_at)
       VALUES ($1, $2, $3, CURRENT_DATE)
       RETURNING id, user_id, title, currency, created_at`,
      [userId, title, currency],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function listAccounts(req, res) {
  const userId = req.user.userId;
  const result = await pool.query(
    `SELECT id, title, currency, created_at
     FROM accounts WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  );
  res.json(result.rows);
}

module.exports = { createAccount, listAccounts };
