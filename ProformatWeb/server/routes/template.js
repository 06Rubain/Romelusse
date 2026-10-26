const express = require('express');
const InvoiceTemplate = require('../models/InvoiceTemplate');
const { ZONES, DEFAULT_ZONES, DEFAULT_LABELS } = require('../models/InvoiceTemplate');
const { HttpError, toNumber } = require('../lib/helpers');
const { requirePermission } = require('../lib/auth');
const { validateImage, validateColor } = require('../lib/images');
const { logActivity } = require('../lib/activity');

const router = express.Router();
const MAX_BACKGROUND_BYTES = 2.5 * 1024 * 1024;
const FONTS = ['Arial, Helvetica, sans-serif', 'Georgia, serif', '\'Times New Roman\', serif', '\'Courier New\', monospace', 'Verdana, sans-serif', 'Inter, sans-serif'];

const clamp = (v, min, max) => Math.min(max, Math.max(min, toNumber(v, min)));

const sanitizeZones = (zones = {}) => Object.fromEntries(ZONES.map((key) => {
  const z = { ...DEFAULT_ZONES[key], ...(zones[key] || {}) };
  const w = clamp(z.w, 1, 100);
  const h = clamp(z.h, 1, 100);
  return [key, {
    x: clamp(z.x, 0, 100 - w),
    y: clamp(z.y, 0, 100 - h),
    w,
    h,
    visible: z.visible !== false,
    align: ['left', 'center', 'right'].includes(z.align) ? z.align : DEFAULT_ZONES[key].align,
  }];
}));

const sanitizeLabels = (labels = {}) => Object.fromEntries(Object.keys(DEFAULT_LABELS).map((key) => [
  key, String(labels[key] ?? DEFAULT_LABELS[key]).slice(0, 60),
]));

const getTemplate = async (companyId) => (await InvoiceTemplate.findOne({ company: companyId }))
  || new InvoiceTemplate({ company: companyId });

router.get('/', async (req, res) => res.json(await getTemplate(req.company._id)));

router.put('/', requirePermission('settings.manage'), async (req, res) => {
  const template = await getTemplate(req.company._id);
  const { mode, background, pageSize, zones, style = {}, labels } = req.body;
  if (mode !== undefined) {
    if (!['standard', 'custom'].includes(mode)) throw new HttpError(400, 'Mode de modèle invalide.');
    template.mode = mode;
  }
  if (background !== undefined) template.background = validateImage(background, 'Modèle importé', MAX_BACKGROUND_BYTES);
  if (pageSize !== undefined) {
    if (!['A4', 'A5'].includes(pageSize)) throw new HttpError(400, 'Format de page invalide.');
    template.pageSize = pageSize;
  }
  if (zones !== undefined) template.zones = sanitizeZones(zones);
  if (labels !== undefined) template.labels = sanitizeLabels(labels);
  const s = template.style;
  if (style.fontFamily !== undefined) s.fontFamily = FONTS.includes(style.fontFamily) ? style.fontFamily : FONTS[0];
  if (style.fontSize !== undefined) s.fontSize = clamp(style.fontSize, 6, 20);
  for (const key of ['textColor', 'headerBg', 'headerText', 'borderColor']) {
    if (style[key] !== undefined) s[key] = validateColor(style[key], 'Couleur du modèle');
  }
  if (style.showBorders !== undefined) s.showBorders = Boolean(style.showBorders);
  if (template.mode === 'custom' && !template.background) {
    throw new HttpError(400, 'Importez d\'abord votre modèle (PDF ou image).');
  }
  template.markModified('zones');
  template.markModified('labels');
  await template.save();
  await logActivity(req.user, 'Paramètres', `Modèle de facture : ${template.mode === 'custom' ? 'modèle importé' : 'modèle standard'}`);
  res.json(template);
});

module.exports = router;
module.exports.FONTS = FONTS;
