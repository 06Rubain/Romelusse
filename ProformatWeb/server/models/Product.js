const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'Général', trim: true },
  sku: { type: String, default: '', trim: true },
  unit: { type: String, default: 'pièce', trim: true },
  unitPrice: { type: Number, default: 0, min: 0 },
  currency: { type: String, enum: ['USD', 'FC'], default: 'USD' },
  // Prix communiqué au cas par cas (ex : Roll-Up "Sur devis")
  priceOnQuote: { type: Boolean, default: false },
  // Prix texte historique (ex : "300 FC"), conservé pour compatibilité
  price: { type: String, default: '' },
  trackStock: { type: Boolean, default: false },
  stockQuantity: { type: Number, default: 0 },
  minStock: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

productSchema.pre('save', function setLegacyPrice() {
  this.price = this.priceOnQuote ? 'Sur devis' : `${this.unitPrice} ${this.currency}`;
});

module.exports = mongoose.model('Product', productSchema);
