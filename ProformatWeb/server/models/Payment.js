const mongoose = require('mongoose');

const METHODS = ['Espèces', 'Mobile Money', 'Virement', 'Chèque', 'Carte'];

const paymentSchema = new mongoose.Schema({
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  invoiceNumber: { type: String, default: '' },
  client: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, enum: ['USD', 'FC'], required: true },
  method: { type: String, enum: METHODS, default: 'Espèces' },
  date: { type: Date, default: Date.now },
  reference: { type: String, default: '' },
  note: { type: String, default: '' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

paymentSchema.index({ invoice: 1 });
paymentSchema.index({ date: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
module.exports.METHODS = METHODS;
