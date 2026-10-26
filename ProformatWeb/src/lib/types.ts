export type Currency = 'USD' | 'FC';
export type Role = 'admin' | 'manager' | 'user';

export interface User {
  _id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: Role;
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

export interface Settings {
  companyName: string;
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
  exchangeRate: number;
  reportingCurrency: Currency;
  paymentTermDays: number;
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
  counts: { pendingProformas: number; clients: number; products: number };
}

export const PAYMENT_METHODS = ['Espèces', 'Mobile Money', 'Virement', 'Chèque', 'Carte'];
export const ROLE_LABELS: Record<Role, string> = { admin: 'Administrateur', manager: 'Gestionnaire', user: 'Employé' };
