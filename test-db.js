const pool = require('./db');

(async () => {
  const res = await pool.query('SELECT NOW() AS now');
  console.log('Connected! DB time:', res.rows[0].now);
  await pool.end();
})().catch((err) => {
  console.error('Connection FAILED:', err.message);
  process.exit(1);
});