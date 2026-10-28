const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Counter = require('../models/Counter');
const Expense = require('../models/Expense');
const CashMovement = require('../models/CashMovement');
const Client = require('../models/Client');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Activity = require('../models/Activity');
const { HttpError, escapeRegex } = require('./helpers');

// Ce que l'on peut effacer ; l'entreprise, ses utilisateurs, ses rôles, son logo et son modèle sont toujours conservés
const SCOPES = {
  sales: 'Factures, proformas et encaissements (la numérotation repart à 0001)',
  money: 'Dépenses et mouvements de trésorerie',
  clients: 'Clients',
  products: 'Produits et mouvements de stock',
  activities: 'Journal d\'activité',
};

const normalize = (s) => String(s || '').trim().toLowerCase();

// Efface les données de test d'une entreprise ; exige le nom exact de l'entreprise en confirmation
const resetCompanyData = async (company, { scopes, confirm }) => {
  const chosen = Array.isArray(scopes) ? scopes.filter((s) => SCOPES[s]) : [];
  if (!chosen.length) throw new HttpError(400, 'Choisissez au moins un type de données à effacer.');
  if (normalize(confirm) !== normalize(company.name)) {
    throw new HttpError(400, `Pour confirmer, saisissez exactement le nom de l'entreprise : ${company.name}`);
  }
  const filter = { company: company._id };
  const deleted = {};
  const remove = async (key, model, query = filter) => { deleted[key] = (await model.deleteMany(query)).deletedCount; };

  if (chosen.includes('sales')) {
    await remove('invoices', Invoice);
    await remove('payments', Payment);
    await remove('counters', Counter, { _id: { $regex: `^${escapeRegex(String(company._id))}:` } });
  }
  if (chosen.includes('money')) {
    await remove('expenses', Expense);
    await remove('cashMovements', CashMovement);
  }
  if (chosen.includes('clients')) await remove('clients', Client);
  if (chosen.includes('products')) {
    await remove('products', Product);
    await remove('stockMovements', StockMovement);
  }
  if (chosen.includes('activities')) await remove('activities', Activity);
  return { scopes: chosen, deleted };
};

module.exports = { resetCompanyData, SCOPES };
