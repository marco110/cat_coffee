const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const COST = 10;

function hash(plain) {
  return bcrypt.hashSync(plain, COST);
}

function compare(plain, hashed) {
  if (!plain || !hashed) return false;
  return bcrypt.compareSync(plain, hashed);
}

/** 8 位随机初始密码（去掉易混淆字符） */
function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(8))
    .map((b) => chars[b % chars.length])
    .join('');
}

module.exports = { hash, compare, randomPassword };
