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

// Types de document : proforma et bon de commande se transforment en facture
export type DocType = 'Proforma' | 'Bon de commande' | 'Facture';
export const DOC_TYPES: DocType[] = ['Proforma', 'Bon de commande', 'Facture'];
export const DOC_INFO: Record<DocType, { title: string; the: string; name: string; choice: string; badge: string }> = {
  Proforma: { title: 'PROFORMA N°', the: 'la proforma', name: 'proforma', choice: 'Proforma', badge: 'badge-neutral' },
  'Bon de commande': { title: 'BON DE COMMANDE N°', the: 'le bon de commande', name: 'bon de commande', choice: 'Bon de commande', badge: 'badge-warning' },
  Facture: { title: 'FACTURE N°', the: 'la facture', name: 'facture', choice: 'Facture', badge: 'badge-info' },
};
export const docTypeFrom = (value: string | null | undefined, fallback: DocType = 'Proforma'): DocType => (
  DOC_TYPES.includes(value as DocType) ? value as DocType : fallback
);

export interface Invoice {
  _id: string;
  publicToken?: string;
  clientPay?: { url: string; qr: string } | null;
  number: string;
  type: DocType;
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
  paymentAccounts: PaymentAccount[];
  checkoutMode: CheckoutMode;
  flexpayMerchant: string;
  flexpayToken?: string;
  flexpayTokenSet?: boolean;
  paymentProvider: 'flexpay' | 'pawapay';
  pawapayEnv: 'sandbox' | 'live';
  pawapayToken?: string;
  pawapayTokenSet?: boolean;
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
  | 'lineTotal' | 'subtotal' | 'discount' | 'grandTotal' | 'amountInWords' | 'paid' | 'cancelled' | 'commande';

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
export type CheckoutMode = 'off' | 'demo' | 'live';
export type AccountProvider = 'M-Pesa' | 'Orange Money' | 'Airtel Money' | 'Africell Money' | 'Banque' | 'Autre';
export const ACCOUNT_PROVIDERS: AccountProvider[] = ['M-Pesa', 'Orange Money', 'Airtel Money', 'Africell Money', 'Banque', 'Autre'];
// Couleur de repère de chaque opérateur sur la page de paiement
export const PROVIDER_COLORS: Record<AccountProvider, string> = {
  'M-Pesa': '#e60000', 'Orange Money': '#ff7900', 'Airtel Money': '#d9001b', 'Africell Money': '#6a1b9a', Banque: '#0f766e', Autre: '#475569',
};
export interface PaymentAccount { provider: AccountProvider; number: string; holder: string; label: string }
export type NoticeStatus = 'En attente' | 'Confirmé' | 'Refusé';
export interface PaymentNotice {
  _id: string; invoice: string; invoiceNumber: string; client: string; provider: string; amount: number; currency: Currency;
  reference: string; payerName: string; payerPhone: string; status: NoticeStatus; handledBy: string; createdAt: string;
}

export const ONLINE_PAYMENT_METHODS = ['M-Pesa', 'Orange Money', 'Airtel Money', 'Africell Money', 'Visa', 'Mastercard', 'RakkaCash', 'Masolo'];

export const TEMPLATE_LABELS: Record<TemplateLabel, string> = {
  facture: 'Titre facture', proforma: 'Titre proforma', commande: 'Titre bon de commande', client: 'Client', date: 'Date', dueDate: 'Échéance',
  quantity: 'Colonne quantité', designation: 'Colonne désignation', unitPrice: 'Colonne prix unitaire', lineTotal: 'Colonne prix total',
  subtotal: 'Total', discount: 'Remise', grandTotal: 'Total général', amountInWords: 'Montant en lettres', paid: 'Cachet payé', cancelled: 'Cachet annulé',
};

export const TEMPLATE_FONTS = ['Arial, Helvetica, sans-serif', 'Georgia, serif', '\'Times New Roman\', serif', '\'Courier New\', monospace', 'Verdana, sans-serif', 'Inter, sans-serif'];
