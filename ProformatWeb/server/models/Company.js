const mongoose = require('mongoose');

// Entreprise cliente de la plateforme OmniCom Facturation (un espace isolé par entreprise)
const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
  // Personnalisation des documents
  logo: { type: String, default: '' }, // image en data URL (PNG, JPEG ou WebP)
  footerImage: { type: String, default: '' }, // bandeau de bas de page optionnel
  primaryColor: { type: String, default: '#009eb5' },
  secondaryColor: { type: String, default: '#e28882' },
  accentColor: { type: String, default: '#c92a2a' },
  // Coordonnées imprimées sur les factures
  legalName: { type: String, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: 'Kinshasa' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  taxNumber: { type: String, default: '' },
  nationalId: { type: String, default: '' },
  rccm: { type: String, default: '' },
  bankName: { type: String, default: '' },
  bankAccount: { type: String, default: '' },
  // Signature (et cachet) de la direction, imprimée sur les factures
  signature: { type: String, default: '' },
  // Paiement en ligne (ex. lien FlexPaie) : lien, QR code calculé par le serveur et moyens acceptés
  paymentLink: { type: String, default: '' },
  paymentQr: { type: String, default: '' },
  paymentMethods: { type: [String], default: [] },
  // Règles de gestion
  exchangeRate: { type: Number, default: 2250, min: 0 },
  reportingCurrency: { type: String, enum: ['USD', 'FC'], default: 'USD' },
  paymentTermDays: { type: Number, default: 30, min: 0 },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

companySchema.set('toJSON', { transform: (_doc, ret) => { delete ret.__v; return ret; } });

module.exports = mongoose.model('Company', companySchema);
