const mongoose = require('mongoose');

const CATEGORIES = ['Matières premières', 'Loyer', 'Salaires', 'Électricité / Eau', 'Transport', 'Maintenance', 'Communication', 'Impôts & taxes', 'Fournitures', 'Autre'];

const expenseSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  category: { type: String, default: 'Autre', trim: true },
  description: { type: String, required: true, trim: true },
  supplier: { type: String, default: '', trim: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: ['USD', 'FC'], default: 'USD' },
  paymentMethod: { type: String, default: 'Espèces' },
  reference: { type: String, default: '' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

expenseSchema.index({ date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
module.exports.CATEGORIES = CATEGORIES;
