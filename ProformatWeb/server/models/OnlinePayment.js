const mongoose = require('mongoose');

// Paiement lancé par le client depuis sa page (Mobile Money ou carte via FlexPaie, ou mode essai)
const STATUSES = ['En cours', 'Réussi', 'Échoué'];

const onlinePaymentSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  invoiceNumber: { type: String, default: '' },
  client: { type: String, default: '' },
  // demo : simulé ; sandbox : vrai appel à l'environnement de test du prestataire ; live : argent réel
  mode: { type: String, enum: ['demo', 'sandbox', 'live'], required: true },
  provider: { type: String, enum: ['demo', 'flexpay', 'pawapay'], default: 'flexpay' },
  method: { type: String, required: true },
  channel: { type: String, enum: ['mobile', 'card'], required: true },
  phone: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, enum: ['USD', 'FC'], required: true },
  // Référence envoyée à FlexPaie, numéro de commande renvoyé par FlexPaie
  reference: { type: String, required: true },
  orderNumber: { type: String, default: '' },
  callbackKey: { type: String, required: true },
  status: { type: String, enum: STATUSES, default: 'En cours' },
  message: { type: String, default: '' },
  lastCheckedAt: { type: Date },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
}, { timestamps: true });

onlinePaymentSchema.index({ invoice: 1, createdAt: -1 });
onlinePaymentSchema.index({ company: 1, createdAt: -1 });
// Une transaction FlexPaie ne peut servir qu'à un seul paiement
onlinePaymentSchema.index({ orderNumber: 1 }, { unique: true, partialFilterExpression: { orderNumber: { $type: 'string', $gt: '' } } });

module.exports = mongoose.model('OnlinePayment', onlinePaymentSchema);
module.exports.STATUSES = STATUSES;
