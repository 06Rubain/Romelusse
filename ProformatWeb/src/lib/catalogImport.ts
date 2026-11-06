import type { Currency } from './types';

export interface ImportedProduct { name: string; category: string; sku: string; unit: string; unitPrice: number; currency: Currency; priceOnQuote: boolean }

// Lecture d'un CSV enregistré depuis Excel ou Google Sheets (séparateur « ; » ou « , », guillemets, BOM)
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i += 1) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

const COLUMNS: Record<keyof Omit<ImportedProduct, 'priceOnQuote'>, string[]> = {
  name: ['nom', 'name', 'designation', 'article', 'produit', 'libelle'],
  category: ['categorie', 'category', 'famille', 'rayon'],
  sku: ['reference', 'ref', 'sku', 'code'],
  unit: ['unite', 'unit'],
  unitPrice: ['prix', 'price', 'prixunitaire', 'pu', 'tarif', 'montant'],
  currency: ['devise', 'currency', 'monnaie'],
};

// « 1 500,50 », « 1.500,50 » ou « 1,500.50 » → 1500.5
const parsePrice = (raw: string) => {
  let s = raw.replace(/[^\d.,-]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const parseCurrency = (raw: string, price: string): Currency => {
  const v = `${raw} ${price}`.toUpperCase();
  return /\bFC\b|CDF|FRANC/.test(v) ? 'FC' : 'USD';
};

// Transforme les lignes du fichier en produits ; les lignes sans nom sont ignorées
export function readCatalog(rows: string[][]) {
  if (rows.length < 2) return { products: [] as ImportedProduct[], missingName: true, ignored: 0 };
  const header = rows[0].map(normalize);
  const index = Object.fromEntries(Object.entries(COLUMNS).map(([key, names]) => [key, header.findIndex((h) => names.includes(h))])) as Record<keyof typeof COLUMNS, number>;
  if (index.name < 0) return { products: [] as ImportedProduct[], missingName: true, ignored: 0 };
  const get = (row: string[], key: keyof typeof COLUMNS) => (index[key] >= 0 ? (row[index[key]] || '').trim() : '');
  let ignored = 0;
  const products: ImportedProduct[] = [];
  for (const row of rows.slice(1)) {
    const name = get(row, 'name');
    if (!name) { ignored += 1; continue; }
    const rawPrice = get(row, 'unitPrice');
    const price = parsePrice(rawPrice);
    const onQuote = !rawPrice || /devis/i.test(rawPrice) || price === null;
    products.push({
      name,
      category: get(row, 'category') || 'Général',
      sku: get(row, 'sku'),
      unit: get(row, 'unit') || 'pièce',
      unitPrice: onQuote ? 0 : price ?? 0,
      currency: parseCurrency(get(row, 'currency'), rawPrice),
      priceOnQuote: onQuote,
    });
  }
  return { products, missingName: false, ignored };
}

export const TEMPLATE_HEADERS = ['Nom', 'Catégorie', 'Prix', 'Devise', 'Unité', 'Référence'];
export const TEMPLATE_ROWS: (string | number)[][] = [
  ['Cartes de visite (100)', 'Impression', 25, 'USD', 'boîte', 'CV-100'],
  ['Impression A4 couleur', 'Impression', 1000, 'FC', 'feuille', ''],
  ['Bâche publicitaire', 'Grand format', 'Sur devis', 'USD', 'm²', ''],
];
