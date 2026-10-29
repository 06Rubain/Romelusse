const Activity = require('../models/Activity');

// Journalise une action ; une erreur de journalisation ne doit jamais bloquer l'opération
const logActivity = async (userOrEmail, action, details = '', company = undefined) => {
  try {
    const userEmail = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email || 'système';
    const acting = typeof userOrEmail === 'object' ? userOrEmail?.$locals?.actingCompany : null;
    const companyId = company !== undefined ? company
      : acting?._id || userOrEmail?.company?._id || userOrEmail?.company || null;
    // Une action d'OmniCom dans une entreprise reste identifiable dans son journal
    const label = acting ? `${userEmail} (OmniCom)` : userEmail;
    await Activity.create({ userEmail: label, action, details, company: companyId });
  } catch (err) {
    console.error('Journalisation impossible :', err.message);
  }
};

module.exports = { logActivity };
