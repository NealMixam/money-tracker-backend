const { createServer } = require("node:http");
const bcrypt = require("bcryptjs");
const pool = require("./db.js");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

const PORT = process.env.PORT || 3000;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/echo") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch (error) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    });
  }

  if (req.method === "POST" && req.url === "/register") {
    try {
      const data = await readBody(req);

      if (!data.email || !data.password) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "email and password required" }));
        return;
      }

      if (typeof data.password !== "string" || data.password.length < 6) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "password must be at least 6 chars" }));
        return;
      }

      const hash = await bcrypt.hash(data.password, 10);

      let result;
      try {
        result = await pool.query(
          "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
          [data.email, hash],
        );
      } catch (err) {
        if (err.code === "23505") {
          res.statusCode = 409;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "email already exists" }));
          return;
        }
        throw err;
      }

      res.statusCode = 201;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result.rows[0]));
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Internal error" }));
    }
  }

  if (req.method === "POST" && req.url === "/login") {
    try {
      const data = await readBody(req);

      if (!data.email || !data.password) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Email and password are required" }));
        return;
      }

      const result = await pool.query(
        "SELECT id, email, password FROM users WHERE email = $1",
        [data.email],
      );

      const user = result.rows[0];

      if (!user || !(await bcrypt.compare(data.password, user.password))) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid credentials" }));
        return;
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "7d" },
      );

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ token }));
    } catch (error) {
      console.error(error);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Internal error" }));
    }
  }

  if (req.method === "GET" && req.url === "/me") {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Missing token" }));
        return;
      }

      const token = authHeader.slice("Bearer ".length).trim();

      let payload;

      try {
        payload = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid or expired token" }));
        return;
      }

      const result = await pool.query(
        "SELECT id, email, created_at FROM users WHERE id = $1",
        [payload.userId],
      );

      const user = result.rows[0];

      if (!user) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "user not found" }));
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(user));
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Internal error" }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
