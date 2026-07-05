const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  client: { type: String, required: true },
  type: { type: String, required: true },
  date: { type: String, required: true },
  total: { type: String, required: true },
  products: { type: Array, required: true },
  number: { type: String, required: true },
  status: { type: String, default: 'En attente' }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
