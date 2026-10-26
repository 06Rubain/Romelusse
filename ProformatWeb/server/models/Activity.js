const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  action: { type: String, required: true }, // ex : "Connexion", "Création de facture"
  details: { type: String },
  date: { type: Date, default: Date.now },
});

ActivitySchema.index({ date: -1 });

module.exports = mongoose.model('Activity', ActivitySchema);
