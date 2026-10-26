import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { InvoiceStatus } from '../lib/types';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted" style={{ margin: '-16px 0 0' }}>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, width = 520 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal card" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Précédent</button>
      <span className="muted">Page {page} sur {pages}</span>
      <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Suivant</button>
    </div>
  );
}

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  'En attente': 'badge-warning',
  'Partiellement payée': 'badge-info',
  'Payée': 'badge-success',
  'Convertie': 'badge-neutral',
  'Annulée': 'badge-danger',
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return <span className={`badge ${STATUS_CLASS[status] || 'badge-neutral'}`}>{status}</span>;
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'danger' | 'success' }) {
  return (
    <div className="card stat-card">
      <div className="muted small">{label}</div>
      <div className={`stat-value ${tone ? `text-${tone}` : ''}`}>{value}</div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return <tr><td colSpan={colSpan} className="empty-cell">{children}</td></tr>;
}

export function Alert({ children, tone = 'danger' }: { children: ReactNode; tone?: 'danger' | 'success' | 'info' }) {
  if (!children) return null;
  return <div className={`alert alert-${tone}`}>{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="input-group">
      <span className="label">{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}
