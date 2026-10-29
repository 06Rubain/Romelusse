export type Currency = 'USD' | 'FC';
export type Permission =
  | 'invoices.create' | 'invoices.cancel' | 'payments.create' | 'payments.delete'
  | 'clients.manage' | 'clients.delete' | 'products.manage' | 'stock.manage'
  | 'expenses.manage' | 'reports.view' | 'activities.view'
  | 'users.manage' | 'roles.manage' | 'settings.manage';

export interface User {
  _id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  isSuperAdmin: boolean;
  company: string | null;
  roleId: string | null;
  roleName: string;
  permissions: Permission[];
  isBlocked: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Balance { invoiced: number; paid: number; due: number }

export interface Client {
  _id: string;
  name: string;
  activity: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxNumber: string;
  notes: string;
  isArchived: boolean;
  invoiceCount?: number;
  balances?: Partial<Record<Currency, Balance>>;
  createdAt: string;
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  category: string;
  sku: string;
  unit: string;
  unitPrice: number;
  currency: Currency;
  priceOnQuote: boolean;
  trackStock: boolean;
  stockQuantity: number;
  minStock: number;
  isActive: boolean;
}

export interface StockMovement {
  _id: string;
  product: string;
  productName: string;
  type: 'in' | 'out' | 'adjust';
  quantity: number;
  stockAfter: number;
  reason: string;
  reference: string;
  createdBy: string;
  createdAt: string;
}

export interface InvoiceLine {
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export type InvoiceStatus = 'En attente' | 'Partiellement payée' | 'Payée' | 'Convertie' | 'Annulée';

export interface Payment {
  _id: string;
  invoice: string;
  invoiceNumber: string;
  client: string;
  amount: number;
  currency: Currency;
  method: string;
  date: string;
  reference: string;
  note: string;
  createdBy: string;
}

export interface Invoice {
  _id: string;
  publicToken?: string;
  number: string;
  type: 'Proforma' | 'Facture';
  clientId: string | null;
  client: string;
  clientActivity: string;
  issueDate: string;
  dueDate: string | null;
  currency: Currency;
  exchangeRate: number;
  products: InvoiceLine[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  status: InvoiceStatus;
  notes: string;
  sourceProforma: string | null;
  convertedTo: string | null;
  createdBy: string;
  createdAt: string;
  payments?: Payment[];
}

export interface Expense {
  _id: string;
  date: string;
  category: string;
  description: string;
  supplier: string;
  amount: number;
  currency: Currency;
  paymentMethod: string;
  reference: string;
  createdBy: string;
}

export interface Activity {
  _id: string;
  userEmail: string;
  action: string;
  details: string;
  date: string;
}

export interface Company {
  _id: string;
  name: string;
  isActive: boolean;
  logo: string;
  footerImage: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  legalName: string;
  address: string;
  city: string;
  email: string;
  phone: string;
  taxNumber: string;
  nationalId: string;
  rccm: string;
  bankName: string;
  bankAccount: string;
  signature: string;
  paymentLink: string;
  paymentQr: string;
  paymentMethods: string[];
  exchangeRate: number;
  reportingCurrency: Currency;
  paymentTermDays: number;
  createdAt: string;
  // Statistiques renvoyées par la console OmniCom
  userCount?: number;
  invoiceCount?: number;
  lastInvoiceAt?: string | null;
}

export interface Role {
  _id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  userCount?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface Amounts {
  byCurrency: Partial<Record<Currency, number>>;
  total: number;
  count: number;
}

export interface Summary {
  reportingCurrency: Currency;
  exchangeRate: number;
  period: { from: string; to: string };
  invoiced: Amounts;
  collected: Amounts;
  expenses: Amounts | null;
  profit: number | null;
  receivables: Amounts;
  overdue: Amounts;
  monthly: { month: string; invoiced: number; collected: number; expenses: number | null }[];
  topClients: { name: string; total: number; count: number }[];
  topProducts: { name: string; quantity: number; total: number }[];
  lowStock: Product[];
  counts: { pendingProformas: number; clients: number; products: number; users: number; invoices: number };
}

export const PAYMENT_METHODS = ['Espèces', 'Mobile Money', 'Virement', 'Chèque', 'Carte'];
export const PERMISSION_GROUPS: { title: string; items: [Permission, string][] }[] = [
  { title: 'Ventes', items: [
    ['invoices.create', 'Créer et modifier factures et proformas'],
    ['invoices.cancel', 'Annuler des factures'],
    ['payments.create', 'Enregistrer des encaissements'],
    ['payments.delete', 'Supprimer des encaissements'],
    ['clients.manage', 'Gérer les clients'],
    ['clients.delete', 'Supprimer / archiver des clients'],
  ] },
  { title: 'Opérations', items: [
    ['products.manage', 'Gérer le catalogue de produits'],
    ['stock.manage', 'Mouvements de stock'],
    ['expenses.manage', 'Gérer les dépenses'],
  ] },
  { title: 'Pilotage', items: [
    ['reports.view', 'Rapports et résultats financiers'],
    ['activities.view', 'Journal d\'activité'],
  ] },
  { title: 'Administration', items: [
    ['users.manage', 'Gérer les utilisateurs'],
    ['roles.manage', 'Gérer les rôles'],
    ['settings.manage', 'Paramètres et personnalisation (logo, couleurs)'],
  ] },
];

export const APP_NAME = 'OmniCom Facturation';

export type ZoneKey = 'meta' | 'client' | 'items' | 'totals' | 'words' | 'notes' | 'stamp' | 'signature' | 'payment';
export interface Zone { x: number; y: number; w: number; h: number; visible: boolean; align: 'left' | 'center' | 'right' }

export interface InvoiceTemplate {
  mode: 'standard' | 'custom';
  background: string;
  pageSize: 'A4' | 'A5';
  zones: Record<ZoneKey, Zone>;
  style: {
    fontFamily: string;
    fontSize: number;
    textColor: string;
    headerBg: string;
    headerText: string;
    borderColor: string;
    showBorders: boolean;
  };
  labels: Record<TemplateLabel, string>;
}

export type TemplateLabel = 'facture' | 'proforma' | 'client' | 'date' | 'dueDate' | 'quantity' | 'designation' | 'unitPrice'
  | 'lineTotal' | 'subtotal' | 'discount' | 'grandTotal' | 'amountInWords' | 'paid' | 'cancelled';

export const ZONE_LABELS: Record<ZoneKey, string> = {
  meta: 'Numéro et dates',
  client: 'Client',
  items: 'Tableau des articles',
  totals: 'Totaux',
  words: 'Montant en lettres',
  notes: 'Notes / conditions',
  stamp: 'Cachet PAYÉ / ANNULÉ',
  signature: 'Signature de la direction',
  payment: 'Paiement en ligne (QR code)',
};

// Moyens de paiement proposés pour le lien de paiement en ligne (ex. FlexPaie)
export const ONLINE_PAYMENT_METHODS = ['M-Pesa', 'Orange Money', 'Airtel Money', 'Africell Money', 'Visa', 'Mastercard', 'RakkaCash', 'Masolo'];

export const TEMPLATE_LABELS: Record<TemplateLabel, string> = {
  facture: 'Titre facture', proforma: 'Titre proforma', client: 'Client', date: 'Date', dueDate: 'Échéance',
  quantity: 'Colonne quantité', designation: 'Colonne désignation', unitPrice: 'Colonne prix unitaire', lineTotal: 'Colonne prix total',
  subtotal: 'Total', discount: 'Remise', grandTotal: 'Total général', amountInWords: 'Montant en lettres', paid: 'Cachet payé', cancelled: 'Cachet annulé',
};

export const TEMPLATE_FONTS = ['Arial, Helvetica, sans-serif', 'Georgia, serif', '\'Times New Roman\', serif', '\'Courier New\', monospace', 'Verdana, sans-serif', 'Inter, sans-serif'];
