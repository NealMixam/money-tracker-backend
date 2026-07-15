const { createServer } = require('node:http');

const PORT = process.env.PORT || 3000;

const server = createServer((req, res)  => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});