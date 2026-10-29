const crypto = require('crypto');
const mongoose = require('mongoose');

// 24 caractères aléatoires : impossible à deviner
const newPublicToken = () => crypto.randomBytes(18).toString('base64url');

const TYPES = ['Proforma', 'Facture'];
const STATUSES = ['En attente', 'Partiellement payée', 'Payée', 'Convertie', 'Annulée'];

const lineSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  // Prix unitaire exprimé dans la devise de la facture
  unitPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  number: { type: String, required: true, trim: true },
  type: { type: String, enum: TYPES, default: 'Facture' },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  client: { type: String, required: true, trim: true },
  clientActivity: { type: String, default: '' },
  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date, default: null },
  currency: { type: String, enum: ['USD', 'FC'], default: 'USD' },
  exchangeRate: { type: Number, default: 0 },
  products: { type: [lineSchema], default: [] },
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  status: { type: String, enum: STATUSES, default: 'En attente' },
  notes: { type: String, default: '' },
  stockApplied: { type: Boolean, default: false },
  sourceProforma: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  convertedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  createdBy: { type: String, default: '' },
  // Lien secret de la page client (voir et payer la facture sans compte)
  publicToken: { type: String },
  // Champs historiques (date texte "jj/mm/aaaa" et total texte "12.00 USD")
  date: { type: String },
  total: { type: String },
}, { timestamps: true });

invoiceSchema.index({ company: 1, number: 1 });
invoiceSchema.index({ company: 1, issueDate: -1 });
invoiceSchema.index({ clientId: 1 });
invoiceSchema.index({ publicToken: 1 }, { unique: true, sparse: true });

// Pas de valeur par défaut : Mongoose l'appliquerait aussi aux anciennes factures à chaque lecture, sans l'enregistrer
invoiceSchema.pre('validate', function ensurePublicToken() {
  if (!this.publicToken) this.publicToken = newPublicToken();
});

invoiceSchema.virtual('balance').get(function balance() {
  return Math.max(0, Math.round((this.totalAmount - this.amountPaid) * 100) / 100);
});
invoiceSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
module.exports.TYPES = TYPES;
module.exports.newPublicToken = newPublicToken;
module.exports.STATUSES = STATUSES;
