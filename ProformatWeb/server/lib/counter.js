const Counter = require('../models/Counter');
const Invoice = require('../models/Invoice');

const PREFIXES = { Facture: 'FAC', Proforma: 'PRO' };

// Numérotation atomique par type et par année : FAC-2026-0001, PRO-2026-0001
const nextInvoiceNumber = async (companyId, type, date = new Date()) => {
  const prefix = PREFIXES[type] || 'FAC';
  const label = `${prefix}-${date.getFullYear()}`;
  // Une séquence par entreprise, type et année
  const key = `${companyId}:${label}`;
  // Évite les collisions avec des numéros déjà saisis manuellement
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const counter = await Counter.findOneAndUpdate(
      { _id: key },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true }
    );
    const number = `${label}-${String(counter.seq).padStart(4, '0')}`;
    if (!(await Invoice.exists({ company: companyId, number }))) return number;
  }
  throw new Error('Impossible de générer un numéro de facture unique.');
};

const peekInvoiceNumber = async (companyId, type, date = new Date()) => {
  const prefix = PREFIXES[type] || 'FAC';
  const label = `${prefix}-${date.getFullYear()}`;
  const counter = await Counter.findById(`${companyId}:${label}`);
  return `${label}-${String((counter?.seq || 0) + 1).padStart(4, '0')}`;
};

module.exports = { nextInvoiceNumber, peekInvoiceNumber };
