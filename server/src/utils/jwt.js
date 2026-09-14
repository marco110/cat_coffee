const jwt = require('jsonwebtoken');
const config = require('../config');

const EXPIRES = {
  CUSTOMER: config.jwt.customerExpires,
  MERCHANT: config.jwt.merchantExpires,
  ADMIN: config.jwt.adminExpires,
};

/** @param {'CUSTOMER'|'MERCHANT'|'ADMIN'} type */
function sign(payload, type) {
  return jwt.sign({ ...payload, type }, config.jwt.secret, { expiresIn: EXPIRES[type] });
}

function verify(token) {
  return jwt.verify(token, config.jwt.secret);
}

module.exports = { sign, verify, EXPIRES };
