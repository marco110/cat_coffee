const express = require('express');

const router = express.Router();
router.use(require('../modules/customer/auth'));
router.use(require('../modules/customer/store'));
router.use(require('../modules/customer/order'));
router.use(require('../modules/customer/member'));
router.use(require('../modules/customer/coupon'));
router.use(require('../modules/customer/upload'));

module.exports = router;
