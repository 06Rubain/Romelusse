import type { Company } from './types';

export type CompanyDraft = Omit<Company, '_id' | 'isActive' | 'createdAt' | 'userCount' | 'invoiceCount' | 'lastInvoiceAt' | 'paymentQr'>;

export const EMPTY_COMPANY: CompanyDraft = {
  name: '', logo: '', footerImage: '', primaryColor: '#009eb5', secondaryColor: '#e28882', accentColor: '#c92a2a',
  legalName: '', address: '', city: 'Kinshasa', email: '', phone: '', taxNumber: '', nationalId: '', rccm: '',
  bankName: '', bankAccount: '', signature: '', paymentLink: '', paymentMethods: [], exchangeRate: 2250, reportingCurrency: 'USD', paymentTermDays: 30,
};

export const toDraft = (c: Company): CompanyDraft => Object.fromEntries(
  Object.keys(EMPTY_COMPANY).map((k) => [k, (c as unknown as Record<string, unknown>)[k] ?? (EMPTY_COMPANY as unknown as Record<string, unknown>)[k]]),
) as unknown as CompanyDraft;
