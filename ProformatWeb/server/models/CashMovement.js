const mongoose = require('mongoose');

// Comptes de trésorerie : où se trouve l'argent
const ACCOUNTS = ['Caisse', 'Mobile Money', 'Banque'];

// Mode de paiement d'un encaissement ou d'une dépense → compte touché
const accountForMethod = (method) => {
  if (method === 'Espèces') return 'Caisse';
  if (method === 'Mobile Money') return 'Mobile Money';
  return 'Banque';
};

// Mouvements d'argent hors factures et dépenses : solde de départ, autre entrée, virement entre comptes
const cashMovementSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  type: { type: String, enum: ['opening', 'in', 'transfer'], required: true },
  date: { type: Date, default: Date.now },
  account: { type: String, enum: ACCOUNTS, required: true },
  toAccount: { type: String, enum: ACCOUNTS },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, enum: ['USD', 'FC'], required: true },
  label: { type: String, default: '', trim: true },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

cashMovementSchema.index({ company: 1, date: -1 });

module.exports = mongoose.model('CashMovement', cashMovementSchema);
module.exports.ACCOUNTS = ACCOUNTS;
module.exports.accountForMethod = accountForMethod;
