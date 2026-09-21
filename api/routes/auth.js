var express = require('express');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');
var requireToken = require('../middleware/auth');
var denylist = require('../data/token-denylist');
var testUser = require('../data/test-user');

var router = express.Router();

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  console.warn('JWT_SECRET not set, using insecure dev fallback');
  return 'dev-only-insecure-secret';
}

/* POST login. */
router.post('/login', function(req, res, next) {
  var email = req.body && req.body.email;
  var password = req.body && req.body.password;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  if (email !== testUser.email || password !== testUser.password) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  var token = jwt.sign(
    { sub: testUser.email, name: testUser.name, jti: crypto.randomUUID() },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '24h' }
  );

  var user = { ...testUser };
  delete user.password;

  res.json({
    token: token,
    tokenType: 'Bearer',
    expiresIn: 86400,
    user: user
  });
});

/* GET profile for the current logged in user. */
router.get('/profile', requireToken, function(req, res, next) {
  if (req.user.sub !== testUser.email) {
    return res.status(404).json({ message: 'User not found' });
  }

  var user = { ...testUser };
  delete user.password;

  res.json(user);
});

/* POST logout, revoking the current token. */
router.post('/logout', requireToken, function(req, res, next) {
  var exp = req.user.exp || Math.floor(Date.now() / 1000) + 86400;
  denylist.revoke(req.user.jti, exp);
  res.json({ message: 'Logged out' });
});

module.exports = router;
