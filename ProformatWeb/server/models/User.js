const crypto = require('crypto');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Identifiant hérité de Firebase ; généré pour les nouveaux comptes
  uid: { type: String, required: true, unique: true, default: () => crypto.randomUUID() },
  email: { type: String, required: true, trim: true, lowercase: true },
  passwordHash: { type: String, select: false },
  displayName: { type: String, default: '', trim: true },
  photoURL: { type: String, default: '' },
  provider: { type: String, default: 'email' },
  // Équipe OmniCom : gère les entreprises de la plateforme (pas d'entreprise rattachée)
  isSuperAdmin: { type: Boolean, default: false },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
  // Rôle texte de la version précédente, conservé pour la migration
  role: { type: String },
  isBlocked: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null, select: false },
  twoFactorEnabled: { type: Boolean, default: false },
  lastLoginAt: { type: Date },
}, { timestamps: true });

userSchema.index({ email: 1 });
userSchema.index({ company: 1 });

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.twoFactorSecret;
    delete ret.role;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
