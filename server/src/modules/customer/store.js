const express = require('express');
const { query, one } = require('../../db');
const { wrap } = require('../../middleware/auth');
const { ok } = require('../../common/response');
const { BizError, CODES } = require('../../common/errors');
const { n, fmt } = require('../../utils/money');
const { parseScene, json } = require('../../utils/misc');
const { formatDish } = require('../../services/price');

const router = express.Router();

function formatStore(s) {
  return {
    id: String(s.id),
    name: s.name,
    logo: s.logo || '',
    cover: s.cover || '',
    intro: s.intro || '',
    announcement: s.announcement || '',
    phone: s.phone || '',
    province: s.province || '',
    city: s.city || '',
    district: s.district || '',
    address: s.address || '',
    longitude: s.longitude === null ? null : n(s.longitude),
    latitude: s.latitude === null ? null : n(s.latitude),
    businessStatus: Number(s.business_status),
    businessHours: `${s.business_hours_start || '09:00'} - ${s.business_hours_end || '22:00'}`,
    allowDineIn: Number(s.allow_dine_in),
    allowTakeaway: Number(s.allow_takeaway),
    needScanTable: Number(s.need_scan_table),
    showSales: Number(s.show_sales),
    memberEnabled: Number(s.member_enabled),
    pointsEnabled: Number(s.points_enabled),
    pickupCodePrefix: s.pickup_code_prefix,
  };
}

/** 扫码解析：scene = s{storeId}t{tableId} */
router.get(
  '/store/scan',
  wrap(async (req, res) => {
    const { storeId, tableId } = parseScene(req.query.scene || '');
    if (!storeId) throw new BizError(CODES.BAD_PARAM, '无效的二维码');
    const store = await one('SELECT * FROM store WHERE id = ? AND deleted_at IS NULL', [storeId]);
    if (!store || Number(store.status) !== 1) {
      throw new BizError(CODES.NOT_FOUND, '门店不存在或已停用');
    }
    let table = null;
    let tableError = null;
    if (tableId) {
      table = await one(
        'SELECT * FROM table_info WHERE id = ? AND store_id = ? AND deleted_at IS NULL',
        [tableId, storeId]
      );
      if (!table || Number(table.status) !== 1) {
        table = null;
        tableError = '桌号无效或已停用，请手动选择桌号';
      }
    }
    const data = {
      store: formatStore(store),
      table: table
        ? { id: String(table.id), tableNo: table.table_no, area: table.area || '', seats: Number(table.seats) }
        : null,
      defaultOrderType: table ? 'DINE_IN' : 'TAKEAWAY',
    };
    if (tableError) {
      return res.json({ code: CODES.TABLE_INVALID, msg: tableError, data, timestamp: Date.now() });
    }
    return ok(res, data);
  })
);

/** 门店信息 */
router.get(
  '/store/:storeId',
  wrap(async (req, res) => {
    const store = await one('SELECT * FROM store WHERE id = ? AND deleted_at IS NULL', [req.params.storeId]);
    if (!store) throw new BizError(CODES.NOT_FOUND, '门店不存在');
    return ok(res, formatStore(store));
  })
);

/** 可用桌位（按区域分组） */
router.get(
  '/store/:storeId/tables',
  wrap(async (req, res) => {
    const rows = await query(
      'SELECT * FROM table_info WHERE store_id = ? AND deleted_at IS NULL AND status = 1 ORDER BY sort, id',
      [req.params.storeId]
    );
    const groups = [];
    const map = new Map();
    rows.forEach((t) => {
      const area = t.area || '默认区域';
      if (!map.has(area)) {
        const g = { area, tables: [] };
        map.set(area, g);
        groups.push(g);
      }
      map.get(area).tables.push({
        id: String(t.id),
        tableNo: t.table_no,
        seats: Number(t.seats),
      });
    });
    return ok(res, { groups, list: rows.map((t) => ({ id: String(t.id), tableNo: t.table_no, area: t.area, seats: Number(t.seats) })) });
  })
);

/** 完整菜单（双栏） */
router.get(
  '/store/:storeId/menu',
  wrap(async (req, res) => {
    const storeId = req.params.storeId;
    const store = await one('SELECT * FROM store WHERE id = ? AND deleted_at IS NULL', [storeId]);
    if (!store) throw new BizError(CODES.NOT_FOUND, '门店不存在');
    const categories = await query(
      'SELECT * FROM category WHERE store_id = ? AND deleted_at IS NULL AND status = 1 ORDER BY sort, id',
      [storeId]
    );
    const dishes = await query(
      `SELECT * FROM dish WHERE store_id = ? AND deleted_at IS NULL
       ORDER BY sort, id`,
      [storeId]
    );
    const result = categories.map((c) => {
      let list = dishes.filter((d) => String(d.category_id) === String(c.id));
      if (Number(store.show_sold_out_dish) !== 1) list = list.filter((d) => Number(d.sold_out) !== 1);
      list = list.filter((d) => Number(d.status) === 1 || Number(store.show_sold_out_dish) === 1);
      return {
        id: String(c.id),
        name: c.name,
        icon: c.icon || '',
        dishCount: list.length,
        dishes: list.map((d) => formatDish(d, store)),
      };
    });
    return ok(res, { categories: result, storeStatus: Number(store.business_status) });
  })
);

/** 轮播图 */
router.get(
  '/store/:storeId/banners',
  wrap(async (req, res) => {
    const rows = await query(
      'SELECT * FROM banner WHERE store_id = ? AND status = 1 ORDER BY sort, id',
      [req.params.storeId]
    );
    return ok(res, rows.map((b) => ({
      id: String(b.id),
      image: b.image,
      linkType: b.link_type,
      linkValue: b.link_value,
    })));
  })
);

/** 菜品搜索 */
router.get(
  '/dish/search',
  wrap(async (req, res) => {
    const { storeId, keyword } = req.query;
    if (!storeId || !keyword) return ok(res, []);
    const store = await one('SELECT * FROM store WHERE id = ?', [storeId]);
    const rows = await query(
      `SELECT * FROM dish WHERE store_id = ? AND deleted_at IS NULL AND status = 1
       AND name LIKE ? ORDER BY sort, id LIMIT 50`,
      [storeId, `%${keyword}%`]
    );
    return ok(res, rows.map((d) => ({ ...formatDish(d, store), categoryId: String(d.category_id) })));
  })
);

/** 菜品详情（含规格） */
router.get(
  '/dish/:dishId',
  wrap(async (req, res) => {
    const dish = await one('SELECT * FROM dish WHERE id = ? AND deleted_at IS NULL', [req.params.dishId]);
    if (!dish) throw new BizError(CODES.NOT_FOUND, '菜品不存在');
    const store = await one('SELECT * FROM store WHERE id = ?', [dish.store_id]);
    const groups = await query(
      'SELECT * FROM dish_spec_group WHERE dish_id = ? AND status = 1 ORDER BY sort, id',
      [dish.id]
    );
    const groupIds = groups.map((g) => g.id);
    let items = [];
    if (groupIds.length) {
      const ph = groupIds.map(() => '?').join(',');
      items = await query(
        `SELECT * FROM dish_spec_item WHERE group_id IN (${ph}) AND status = 1 ORDER BY sort, id`,
        groupIds
      );
    }
    const addons = await query(
      'SELECT * FROM addon WHERE store_id = ? AND status = 1 AND deleted_at IS NULL ORDER BY sort, id',
      [dish.store_id]
    );
    return ok(res, {
      ...formatDish(dish, store),
      images: json(dish.images, []) || [],
      specGroups: groups.map((g) => ({
        id: String(g.id),
        name: g.name,
        isRequired: Number(g.is_required),
        multiSelect: Number(g.multi_select),
        items: items
          .filter((i) => String(i.group_id) === String(g.id))
          .map((i) => ({
            id: String(i.id),
            name: i.name,
            extraPrice: n(i.extra_price),
            isDefault: Number(i.is_default),
          })),
      })),
      addons: addons.map((a) => ({ id: String(a.id), name: a.name, price: n(a.price) })),
    });
  })
);

module.exports = router;
module.exports.formatStore = formatStore;
