const express = require('express');
const Company = require('../models/Company');
const { HttpError } = require('../lib/helpers');
const { requirePermission } = require('../lib/auth');
const { sanitizeCompany } = require('../lib/company');
const { logActivity } = require('../lib/activity');
const { resetCompanyData } = require('../lib/reset');

const router = express.Router();

// Profil, personnalisation et règles de l'entreprise connectée
// Seule route qui renvoie les images de l'entreprise (le reste de l'API les ignore)
// La clé FlexPaie n'est jamais renvoyée : seulement le fait qu'elle est enregistrée
const withSecrets = async (company) => {
  const secret = await Company.findById(company._id).select('+flexpayToken').lean();
  return { ...company.toJSON(), flexpayTokenSet: !!secret?.flexpayToken };
};

router.get('/', async (req, res) => res.json(await withSecrets(await Company.findById(req.company._id))));

router.put('/', requirePermission('settings.manage'), async (req, res) => {
  const data = await sanitizeCompany(req.body);
  if (data.name === '') throw new HttpError(400, 'Le nom de l\'entreprise est obligatoire.');
  const company = await Company.findByIdAndUpdate(req.company._id, data, { returnDocument: 'after', runValidators: true });
  await logActivity(req.user, 'Paramètres', 'Mise à jour des paramètres de l\'entreprise');
  res.json(await withSecrets(company));
});

// Effacement des données de test (l'entreprise, ses comptes et sa personnalisation sont conservés)
router.post('/reset', requirePermission('settings.manage'), async (req, res) => {
  const result = await resetCompanyData(req.company, req.body);
  const summary = (r) => Object.entries(r.deleted).map(([k, n]) => `${n} ${k}`).join(', ') || 'rien';
  await logActivity(req.user, 'Paramètres', `Effacement des données de test : ${summary(result)}`);
  res.json(result);
});

module.exports = router;
