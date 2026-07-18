const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("./db.js");
const jwt = require("jsonwebtoken");
const authenticate = require("./auth.js");
const JWT_SECRET = process.env.JWT_SECRET;

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

app.post("/register", async (req, res) => {
  if (!req.body.email || !req.body.password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  if (typeof req.body.password !== "string" || req.body.password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 symbols" });
    return;
  }

  const hash = await bcrypt.hash(req.body.password, 10);

  let result;

  try {
    result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
      [req.body.email, hash],
    );
  } catch (error) {
    if (error.code === "23505") {
      res.status(409).json({ error: "Email already exists" });
      return;
    }
    throw error;
  }

  res.status(201).json(result.rows[0]);
});

app.post("/login", async (req, res) => {
  if (!req.body.email || !req.body.password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const result = await pool.query(
    "SELECT id, email, password FROM users WHERE email = $1",
    [req.body.email],
  );

  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });

  res.status(200).json({ token });
});

app.get("/me", authenticate, (req, res) => {
  res.json({ id: req.user.userId, email: req.user.email });
});

app.listen(PORT, () => console.log(`Server on ${PORT}`));
