const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  userEmail: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    required: true, // e.g., "Connexion", "Création de facture"
  },
  details: {
    type: String, // e.g., "Facture N° 070-57-1234 pour Client X"
  },
  date: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('Activity', ActivitySchema);
