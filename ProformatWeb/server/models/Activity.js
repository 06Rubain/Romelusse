const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null }, // null : action de la plateforme
  userEmail: { type: String, required: true },
  action: { type: String, required: true }, // ex : "Connexion", "Création de facture"
  details: { type: String },
  date: { type: Date, default: Date.now },
});

ActivitySchema.index({ company: 1, date: -1 });

module.exports = mongoose.model('Activity', ActivitySchema);
