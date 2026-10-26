const crypto = require('crypto');
const mongoose = require('mongoose');

const ROLES = ['admin', 'manager', 'user'];

const userSchema = new mongoose.Schema({
  // Identifiant hérité de Firebase ; généré pour les nouveaux comptes
  uid: { type: String, required: true, unique: true, default: () => crypto.randomUUID() },
  email: { type: String, required: true, trim: true, lowercase: true },
  passwordHash: { type: String, select: false },
  displayName: { type: String, default: '', trim: true },
  photoURL: { type: String, default: '' },
  provider: { type: String, default: 'email' },
  role: { type: String, enum: ROLES, default: 'user' },
  isBlocked: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null, select: false },
  twoFactorEnabled: { type: Boolean, default: false },
  lastLoginAt: { type: Date },
}, { timestamps: true });

userSchema.index({ email: 1 });

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.twoFactorSecret;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
