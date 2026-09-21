var express = require('express');
var router = express.Router();

/* GET healthcheck. */
router.get('/', function(req, res, next) {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
