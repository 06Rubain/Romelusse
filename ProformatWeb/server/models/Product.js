const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
