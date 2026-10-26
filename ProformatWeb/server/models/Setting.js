const mongoose = require('mongoose');

// Document unique (_id: "company") contenant la configuration de l'entreprise
const settingSchema = new mongoose.Schema({
  _id: { type: String, default: 'company' },
  companyName: { type: String, default: 'Mélanine Print' },
  legalName: { type: String, default: 'ETS MELANINE PRINT' },
  address: { type: String, default: '6, av. Macampagne, Q/Jolie-parc, Kinshasa/ Ngaliema.' },
  city: { type: String, default: 'Kinshasa' },
  email: { type: String, default: 'melanineprint@hotmail.com' },
  phone: { type: String, default: '+243 890 360 756 / 820 600 566' },
  taxNumber: { type: String, default: 'A2546990E' },
  nationalId: { type: String, default: '01-C1700-N79672H' },
  rccm: { type: String, default: 'CD/KNG/RCCM/25-A-06400' },
  bankName: { type: String, default: 'RAWBANK' },
  bankAccount: { type: String, default: '05100-00004-01205505001-17 USD' },
  exchangeRate: { type: Number, default: 2250, min: 0 },
  reportingCurrency: { type: String, enum: ['USD', 'FC'], default: 'USD' },
  paymentTermDays: { type: Number, default: 30, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
