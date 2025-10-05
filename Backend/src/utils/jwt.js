const jwt = require('jsonwebtoken');
const config = require('../config');

const generateToken = (userId) => {
  const payload = { sub: userId };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

module.exports = {
  generateToken,
  verifyToken,
};