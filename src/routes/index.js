const router = require('express').Router();

router.get('/', (req, res) => {
  res.type('text/plain');
  res.send('Hello, World!\n');
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

module.exports = router;
