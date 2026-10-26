const Activity = require('../models/Activity');

// Journalise une action ; une erreur de journalisation ne doit jamais bloquer l'opération
const logActivity = async (userOrEmail, action, details = '') => {
  try {
    const userEmail = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email || 'système';
    await Activity.create({ userEmail, action, details });
  } catch (err) {
    console.error('Journalisation impossible :', err.message);
  }
};

module.exports = { logActivity };
