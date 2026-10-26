const bcrypt = require('bcryptjs');
const User = require('../models/User');

const DEFAULT_ADMIN_EMAIL = 'mpunantitarubain@gmail.com';

// Crée le compte administrateur OmniCom depuis les variables d'environnement
// (OMNICOM_ADMIN_EMAIL / OMNICOM_ADMIN_PASSWORD), sans passer par l'écran d'installation.
// Ne fait rien si un super-admin existe déjà : un mot de passe changé dans l'application n'est jamais écrasé.
const ensureSuperAdmin = async () => {
  const password = process.env.OMNICOM_ADMIN_PASSWORD;
  if (!password) return null;
  if (password.length < 8) {
    console.error('OMNICOM_ADMIN_PASSWORD doit contenir au moins 8 caractères : compte OmniCom non créé.');
    return null;
  }
  if (await User.exists({ isSuperAdmin: true })) return null;

  const email = String(process.env.OMNICOM_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);
  // Un compte existant avec cet e-mail (ancienne version) devient le compte OmniCom
  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: { isSuperAdmin: true, company: null, roleId: null, passwordHash, isBlocked: false },
      $setOnInsert: { email, displayName: 'Administrateur OmniCom' },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  console.log(`Compte administrateur OmniCom prêt : ${user.email}`);
  return user;
};

module.exports = { ensureSuperAdmin, DEFAULT_ADMIN_EMAIL };
