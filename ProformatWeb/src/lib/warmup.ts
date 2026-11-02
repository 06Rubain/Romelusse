import { api } from './api';

// Après la connexion, garde sur l'appareil ce qu'il faut pour travailler hors ligne :
// tableau de bord, catalogue, clients, modèle de facture et prochains numéros.
// Les paramètres doivent être exactement ceux utilisés par les pages pour être retrouvés hors ligne.
// Une seule préparation par session (utilisateur + entreprise), pas à chaque rafraîchissement
let warmed = '';

export const warmOfflineCache = (sessionKey: string, company: boolean) => {
  if (!navigator.onLine || warmed === sessionKey) return;
  warmed = sessionKey;
  // La session elle-même : l'application doit pouvoir se rouvrir hors ligne juste après la connexion
  const session = api.get('/auth/me');
  if (!company) { Promise.allSettled([session]); return; }
  const calls = [
    session,
    api.get('/products', { active: 'true' }),
    api.get('/clients'),
    api.get('/company/template'),
    api.get('/invoices/next-number', { type: 'Proforma' }),
    api.get('/invoices/next-number', { type: 'Facture' }),
    api.get('/reports/summary'),
    api.get('/invoices', { limit: 8 }),
    api.get('/invoices', { overdue: 'true', limit: 5 }),
  ];
  Promise.allSettled(calls);
};
