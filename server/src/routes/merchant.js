const express = require('express');

const router = express.Router();
router.use(require('../modules/merchant/auth'));
router.use(require('../modules/merchant/dashboard'));
router.use(require('../modules/merchant/order'));
router.use(require('../modules/merchant/category'));
router.use(require('../modules/merchant/dish'));
router.use(require('../modules/merchant/table'));
router.use(require('../modules/merchant/coupon'));
router.use(require('../modules/merchant/member'));
router.use(require('../modules/merchant/store'));
router.use(require('../modules/merchant/stat'));
router.use(require('../modules/merchant/upload'));

module.exports = router;
