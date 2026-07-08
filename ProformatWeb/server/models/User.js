const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  displayName: { type: String, default: '' },
  provider: { type: String, default: 'email' },
  role: { type: String, default: 'user' },
  isBlocked: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null },
  twoFactorEnabled: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
