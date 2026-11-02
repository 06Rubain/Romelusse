import { api } from './api';

// Après la connexion, garde sur l'appareil ce qu'il faut pour travailler hors ligne :
// tableau de bord, catalogue, clients, modèle de facture et prochains numéros.
// Les paramètres doivent être exactement ceux utilisés par les pages pour être retrouvés hors ligne.
export const warmOfflineCache = (company: boolean) => {
  if (!company || !navigator.onLine) return;
  const calls = [
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
