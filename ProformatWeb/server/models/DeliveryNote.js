const mongoose = require('mongoose');

// Bon de livraison : ce qui a été remis au client (quantités commandées / livrées), sans prix
const lineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ordered: { type: Number, default: 0, min: 0 },
  delivered: { type: Number, required: true, min: 0 },
  // Position de la ligne dans le document d'origine (pour suivre les livraisons partielles)
  source: { type: Number, default: null },
}, { _id: false });

const deliveryNoteSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  number: { type: String, required: true, trim: true },
  // Document d'origine (facture ou bon de commande), facultatif pour une livraison libre
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
  invoiceNumber: { type: String, default: '' },
  client: { type: String, required: true, trim: true },
  clientActivity: { type: String, default: '' },
  deliveryAddress: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  lines: { type: [lineSchema], default: [] },
  deliveredBy: { type: String, default: '' },
  receivedBy: { type: String, default: '' },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['Livré', 'Annulé'], default: 'Livré' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

deliveryNoteSchema.index({ company: 1, number: 1 }, { unique: true });
deliveryNoteSchema.index({ company: 1, invoice: 1 });
deliveryNoteSchema.index({ company: 1, date: -1 });
deliveryNoteSchema.set('toJSON', { transform: (_doc, ret) => { delete ret.__v; return ret; } });

module.exports = mongoose.model('DeliveryNote', deliveryNoteSchema);
