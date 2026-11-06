const mongoose = require('mongoose');

// Paiement annoncé par un client depuis sa page de facture (« J'ai payé ») : l'entreprise le vérifie puis le confirme ou le refuse
const STATUSES = ['En attente', 'Confirmé', 'Refusé'];

const paymentNoticeSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  invoiceNumber: { type: String, default: '' },
  client: { type: String, default: '' },
  provider: { type: String, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, enum: ['USD', 'FC'], required: true },
  reference: { type: String, required: true },
  payerName: { type: String, default: '' },
  payerPhone: { type: String, default: '' },
  status: { type: String, enum: STATUSES, default: 'En attente' },
  handledBy: { type: String, default: '' },
  handledAt: { type: Date },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
}, { timestamps: true });

paymentNoticeSchema.index({ company: 1, status: 1, createdAt: -1 });
paymentNoticeSchema.index({ invoice: 1 });

module.exports = mongoose.model('PaymentNotice', paymentNoticeSchema);
module.exports.STATUSES = STATUSES;
