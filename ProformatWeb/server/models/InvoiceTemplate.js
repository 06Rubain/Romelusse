const mongoose = require('mongoose');

// Zones positionnées en pourcentage de la page (x, y, largeur, hauteur), validées par la route
const ZONES = ['meta', 'client', 'items', 'totals', 'words', 'notes', 'stamp'];

// Disposition par défaut : laisse de la place à l'en-tête et au pied de page du modèle importé
const DEFAULT_ZONES = {
  meta: { x: 55, y: 6, w: 40, h: 9, visible: true, align: 'right' },
  client: { x: 6, y: 17, w: 50, h: 8, visible: true, align: 'left' },
  items: { x: 6, y: 27, w: 88, h: 38, visible: true, align: 'left' },
  totals: { x: 54, y: 66, w: 40, h: 10, visible: true, align: 'right' },
  words: { x: 6, y: 77, w: 60, h: 6, visible: true, align: 'left' },
  notes: { x: 6, y: 84, w: 55, h: 6, visible: true, align: 'left' },
  stamp: { x: 64, y: 78, w: 30, h: 10, visible: true, align: 'center' },
};

const DEFAULT_LABELS = {
  facture: 'FACTURE N°',
  proforma: 'PROFORMA N°',
  client: 'Client',
  date: 'Date',
  dueDate: 'Échéance',
  quantity: 'Qté',
  designation: 'Désignation',
  unitPrice: 'P.U',
  lineTotal: 'P.T',
  subtotal: 'Total',
  discount: 'Remise',
  grandTotal: 'Total général',
  amountInWords: 'Arrêté à la somme de',
  paid: 'PAYÉ',
  cancelled: 'ANNULÉ',
};

const templateSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
  // standard : modèle intégré aux couleurs de l'entreprise ; custom : modèle importé
  mode: { type: String, enum: ['standard', 'custom'], default: 'standard' },
  background: { type: String, default: '' }, // image de la page (data URL), issue d'un PDF ou d'une image
  pageSize: { type: String, enum: ['A4', 'A5'], default: 'A4' },
  zones: {
    type: Object,
    default: () => JSON.parse(JSON.stringify(DEFAULT_ZONES)),
  },
  style: {
    fontFamily: { type: String, default: 'Arial, Helvetica, sans-serif' },
    fontSize: { type: Number, default: 11, min: 6, max: 20 },
    textColor: { type: String, default: '#111111' },
    headerBg: { type: String, default: '#009eb5' },
    headerText: { type: String, default: '#ffffff' },
    borderColor: { type: String, default: '#333333' },
    showBorders: { type: Boolean, default: true },
  },
  labels: { type: Object, default: () => ({ ...DEFAULT_LABELS }) },
}, { timestamps: true, minimize: false });

module.exports = mongoose.model('InvoiceTemplate', templateSchema);
module.exports.ZONES = ZONES;
module.exports.DEFAULT_ZONES = DEFAULT_ZONES;
module.exports.DEFAULT_LABELS = DEFAULT_LABELS;
