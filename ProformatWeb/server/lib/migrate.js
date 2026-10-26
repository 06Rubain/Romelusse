const mongoose = require('mongoose');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const Payment = require('../models/Payment');
const { parseLegacyPrice, parseFrenchDate, convert, round2 } = require('./helpers');

const LEGACY_RATE = 2250;

// Convertit les documents créés par l'ancienne version (prix et totaux en texte).
// Idempotent : seuls les documents sans les nouveaux champs sont traités.
const migrateLegacyData = async () => {
  const legacyProducts = await Product.collection.find({ unitPrice: { $exists: false } }).toArray();
  for (const p of legacyProducts) {
    const { unitPrice, currency, onQuote } = parseLegacyPrice(p.price);
    await Product.collection.updateOne({ _id: p._id }, {
      $set: {
        unitPrice,
        currency,
        priceOnQuote: onQuote,
        category: p.category || 'Général',
        unit: p.unit || 'pièce',
        trackStock: false,
        stockQuantity: 0,
        minStock: 0,
        isActive: true,
      },
    });
  }

  const legacyInvoices = await Invoice.collection.find({ totalAmount: { $exists: false } }).toArray();
  for (const inv of legacyInvoices) {
    const parsedTotal = parseLegacyPrice(inv.total);
    const currency = parsedTotal.currency;
    const products = (inv.products || []).map((item) => {
      const { unitPrice, currency: itemCurrency } = parseLegacyPrice(item.price);
      const converted = round2(convert(unitPrice, itemCurrency, currency, LEGACY_RATE));
      const quantity = Number(item.quantity) || 0;
      const rawId = item.productId || item.id || item._id;
      return {
        productId: rawId && mongoose.isValidObjectId(rawId) ? new mongoose.Types.ObjectId(String(rawId)) : null,
        name: item.name || 'Article',
        quantity,
        unitPrice: converted,
        lineTotal: round2(converted * quantity),
      };
    });
    const totalAmount = parsedTotal.unitPrice;
    const isPaid = inv.status === 'Payée';
    // Le filtre garantit qu'une seule instance migre ce document (exécutions concurrentes)
    const result = await Invoice.collection.updateOne({ _id: inv._id, totalAmount: { $exists: false } }, {
      $set: {
        type: inv.type === 'Proforma' ? 'Proforma' : 'Facture',
        currency,
        exchangeRate: LEGACY_RATE,
        products,
        subtotal: totalAmount,
        discount: 0,
        totalAmount,
        amountPaid: isPaid ? totalAmount : 0,
        status: isPaid ? 'Payée' : 'En attente',
        issueDate: parseFrenchDate(inv.date) || inv.createdAt || new Date(),
        stockApplied: false,
      },
    });
    // Les factures marquées "Payée" reçoivent un encaissement pour alimenter les rapports
    if (result.modifiedCount === 1 && isPaid && totalAmount > 0) {
      await Payment.create({
        invoice: inv._id,
        invoiceNumber: inv.number,
        client: inv.client,
        amount: totalAmount,
        currency,
        method: 'Espèces',
        date: inv.updatedAt || inv.createdAt || new Date(),
        note: 'Reprise des données (ancienne version)',
        createdBy: 'migration',
      });
    }
  }

  // Création des fiches clients à partir des noms saisis sur les factures
  const orphanNames = await Invoice.distinct('client', { clientId: null });
  for (const name of orphanNames) {
    if (!name || !name.trim()) continue;
    const sample = await Invoice.findOne({ client: name, clientId: null }).sort({ createdAt: -1 });
    let client = await Client.findOne({ name: name.trim() });
    if (!client) client = await Client.create({ name: name.trim(), activity: sample?.clientActivity || '' });
    await Invoice.updateMany({ client: name, clientId: null }, { $set: { clientId: client._id } });
  }

  if (legacyProducts.length || legacyInvoices.length) {
    console.log(`Migration : ${legacyProducts.length} produit(s), ${legacyInvoices.length} facture(s) mis à jour.`);
  }
};

module.exports = { migrateLegacyData };
