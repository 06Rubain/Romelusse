const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  activity: { type: String, default: '', trim: true },
  contactPerson: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true, lowercase: true },
  address: { type: String, default: '', trim: true },
  taxNumber: { type: String, default: '', trim: true },
  notes: { type: String, default: '' },
  isArchived: { type: Boolean, default: false },
}, { timestamps: true });

clientSchema.index({ name: 1 });

module.exports = mongoose.model('Client', clientSchema);
