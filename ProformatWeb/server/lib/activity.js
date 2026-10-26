const Activity = require('../models/Activity');

// Journalise une action ; une erreur de journalisation ne doit jamais bloquer l'opération
const logActivity = async (userOrEmail, action, details = '', company = undefined) => {
  try {
    const userEmail = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email || 'système';
    const companyId = company !== undefined ? company : userOrEmail?.company?._id || userOrEmail?.company || null;
    await Activity.create({ userEmail, action, details, company: companyId });
  } catch (err) {
    console.error('Journalisation impossible :', err.message);
  }
};

module.exports = { logActivity };
