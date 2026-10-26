import type { Currency } from './types';

export const formatMoney = (amount: number | null | undefined, currency: Currency | string = 'USD') => {
  const value = Number(amount) || 0;
  const digits = currency === 'FC' ? 0 : 2;
  const str = value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: 2 });
  return currency === 'USD' ? `${str} $` : `${str} ${currency}`;
};

// Montants par devise, ex : "120,00 $ · 45 000 FC"
export const formatByCurrency = (byCurrency: Partial<Record<Currency, number>> | undefined) => {
  const parts = Object.entries(byCurrency || {})
    .filter(([, v]) => v)
    .map(([c, v]) => formatMoney(v, c));
  return parts.length ? parts.join(' · ') : '—';
};

export const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
};

export const formatDateTime = (value: string | Date | null | undefined) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
};

// Valeur pour <input type="date">
export const toInputDate = (value?: string | Date | null) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
};

export const convertAmount = (amount: number, from: Currency, to: Currency, rate: number) => {
  if (from === to || !rate) return amount;
  return from === 'USD' ? amount * rate : amount / rate;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

// Export CSV compatible Excel (séparateur point-virgule, BOM UTF-8)
export const downloadCsv = (filename: string, headers: string[], rows: (string | number | null | undefined)[][]) => {
  const escape = (v: string | number | null | undefined) => {
    // Les nombres utilisent la virgule décimale attendue par Excel en français
    const s = v === null || v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(';')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const PRINT_SCALE = { A4: 1, A5: 0.71, A6: 0.5 } as const;
