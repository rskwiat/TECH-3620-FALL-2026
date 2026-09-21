var jwt = require('jsonwebtoken');
var denylist = require('../data/token-denylist');

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  console.warn('JWT_SECRET not set, using insecure dev fallback');
  return 'dev-only-insecure-secret';
}

/* Require a valid Bearer token on the request. */
function requireToken(req, res, next) {
  var header = req.headers.authorization || '';
  var parts = header.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({ message: 'Missing or malformed Authorization header' });
  }

  try {
    var decoded = jwt.verify(parts[1], getJwtSecret(), { algorithms: ['HS256'] });
    if (decoded.jti && denylist.isRevoked(decoded.jti)) {
      return res.status(401).json({ message: 'Token has been revoked' });
    }
    req.user = decoded;
    req.token = parts[1];
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = requireToken;
