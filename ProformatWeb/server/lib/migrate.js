const fs = require('fs');
const qrcode = require('qrcode');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const Payment = require('../models/Payment');
const Company = require('../models/Company');
const Role = require('../models/Role');
const User = require('../models/User');
const { createDefaultRoles } = require('../models/Role');
const { parseLegacyPrice, parseFrenchDate, convert, round2 } = require('./helpers');

const MELANINE_PAYMENT_LINK = 'https://vpos.flexpaie.com/pay/FPG_DRC';

const LEGACY_RATE = 2250;
const SCOPED_COLLECTIONS = ['products', 'invoices', 'clients', 'payments', 'expenses', 'stockmovements', 'activities'];
const LEGACY_ROLE_NAMES = { admin: 'Administrateur', manager: 'Gestionnaire', user: 'Employé' };

const dataUrl = (file) => {
  try {
    return `data:image/png;base64,${fs.readFileSync(path.join(__dirname, '..', 'assets', file)).toString('base64')}`;
  } catch {
    return '';
  }
};

// Les données d'avant la version multi-entreprise appartiennent à Mélanine Print
const assignLegacyCompany = async () => {
  const db = mongoose.connection.db;
  const noCompany = { company: { $exists: false } };
  const counts = await Promise.all(SCOPED_COLLECTIONS.map((c) => db.collection(c).countDocuments(noCompany)));
  const legacyUsers = await User.collection.countDocuments({ ...noCompany, isSuperAdmin: { $ne: true } });
  if (!counts.some(Boolean) && !legacyUsers) return null;

  const oldSettings = await db.collection('settings').findOne({ _id: 'company' });
  let company = await Company.findOne({ name: oldSettings?.companyName || 'Mélanine Print' });
  if (!company) {
    company = await Company.create({
      name: oldSettings?.companyName || 'Mélanine Print',
      legalName: oldSettings?.legalName || 'ETS MELANINE PRINT',
      address: oldSettings?.address || '6, av. Macampagne, Q/Jolie-parc, Kinshasa/ Ngaliema.',
      city: oldSettings?.city || 'Kinshasa',
      email: oldSettings?.email || 'melanineprint@hotmail.com',
      phone: oldSettings?.phone || '+243 890 360 756 / 820 600 566',
      taxNumber: oldSettings?.taxNumber || 'A2546990E',
      nationalId: oldSettings?.nationalId || '01-C1700-N79672H',
      rccm: oldSettings?.rccm || 'CD/KNG/RCCM/25-A-06400',
      bankName: oldSettings?.bankName || 'RAWBANK',
      bankAccount: oldSettings?.bankAccount || '05100-00004-01205505001-17 USD',
      exchangeRate: oldSettings?.exchangeRate || LEGACY_RATE,
      reportingCurrency: oldSettings?.reportingCurrency || 'USD',
      paymentTermDays: oldSettings?.paymentTermDays ?? 30,
      logo: dataUrl('melanine-logo.png'),
      footerImage: dataUrl('melanine-footer.png'),
      // Charte officielle : bandeau turquoise → violet → saumon, étiquettes rouges
      primaryColor: '#00a4aa',
      secondaryColor: '#e78a7d',
      accentColor: '#b6100d',
      // Paiement en ligne FlexPaie de Mélanine Print
      paymentLink: MELANINE_PAYMENT_LINK,
      paymentQr: await qrcode.toDataURL(MELANINE_PAYMENT_LINK, { margin: 1, width: 240 }),
      paymentMethods: ['M-Pesa', 'Orange Money', 'Airtel Money', 'Africell Money', 'Visa', 'Mastercard', 'RakkaCash', 'Masolo'],
      createdBy: 'migration',
    });
  }
  await createDefaultRoles(company._id);

  for (const name of SCOPED_COLLECTIONS) {
    await db.collection(name).updateMany(noCompany, { $set: { company: company._id } });
  }

  const roles = await Role.find({ company: company._id });
  const roleByName = Object.fromEntries(roles.map((r) => [r.name, r._id]));
  const users = await User.collection.find({ ...noCompany, isSuperAdmin: { $ne: true } }).toArray();
  for (const u of users) {
    const roleName = LEGACY_ROLE_NAMES[u.role] || 'Employé';
    await User.collection.updateOne({ _id: u._id }, { $set: { company: company._id, roleId: roleByName[roleName] } });
  }

  // Les compteurs de numérotation deviennent propres à l'entreprise
  const counters = await db.collection('counters').find({ _id: { $regex: /^(FAC|PRO)-\d{4}$/ } }).toArray();
  for (const c of counters) {
    await db.collection('counters').updateOne({ _id: `${company._id}:${c._id}` }, { $max: { seq: c.seq } }, { upsert: true });
    await db.collection('counters').deleteOne({ _id: c._id });
  }
  return company;
};

// Convertit les documents de la toute première version (prix et totaux en texte).
const normalizeLegacyDocuments = async () => {
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
        company: inv.company,
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
  const orphans = await Invoice.aggregate([
    { $match: { clientId: null } },
    { $group: { _id: { company: '$company', client: '$client' }, activity: { $last: '$clientActivity' } } },
  ]);
  for (const { _id: { company, client: name }, activity } of orphans) {
    if (!name || !name.trim()) continue;
    let client = await Client.findOne({ company, name: name.trim() });
    if (!client) client = await Client.create({ company, name: name.trim(), activity: activity || '' });
    await Invoice.updateMany({ company, client: name, clientId: null }, { $set: { clientId: client._id } });
  }

  return { products: legacyProducts.length, invoices: legacyInvoices.length };
};

// Idempotente : peut s'exécuter à chaque démarrage
const migrateLegacyData = async () => {
  const company = await assignLegacyCompany();
  const counts = await normalizeLegacyDocuments();
  if (company || counts.products || counts.invoices) {
    console.log(`Migration : entreprise ${company?.name || '—'}, ${counts.products} produit(s), ${counts.invoices} facture(s).`);
  }
};

module.exports = { migrateLegacyData };
