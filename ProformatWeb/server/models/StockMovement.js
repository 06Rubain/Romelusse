const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, default: '' },
  // in : entrée (achat, retour), out : sortie (vente, perte), adjust : inventaire
  type: { type: String, enum: ['in', 'out', 'adjust'], required: true },
  quantity: { type: Number, required: true },
  stockAfter: { type: Number, required: true },
  reason: { type: String, default: '' },
  reference: { type: String, default: '' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

stockMovementSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
