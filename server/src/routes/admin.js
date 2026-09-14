const express = require('express');

const router = express.Router();
router.use(require('../modules/admin/auth'));
router.use(require('../modules/admin/dashboard'));
router.use(require('../modules/admin/store'));
router.use(require('../modules/admin/store-user'));
router.use(require('../modules/admin/order'));
router.use(require('../modules/admin/member-level'));
router.use(require('../modules/admin/config'));
router.use(require('../modules/admin/log'));
router.use(require('../modules/admin/file'));

module.exports = router;
