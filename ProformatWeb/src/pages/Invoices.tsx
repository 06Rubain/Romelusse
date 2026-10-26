import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FilePlus2, Search, Wallet, Printer, ArrowRightLeft, Ban } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { useAuth } from '../auth/AuthContext';
import { downloadCsv, formatDate, formatMoney } from '../lib/format';
import type { Invoice, Paginated } from '../lib/types';
import { Alert, EmptyRow, PageHeader, Pagination, StatusBadge } from '../components/ui';
import PaymentModal from '../components/PaymentModal';

const STATUSES = ['En attente', 'Partiellement payée', 'Payée', 'Convertie', 'Annulée'];

export default function Invoices() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [error, setError] = useState('');

  const filters = { search, type, status: status === 'unpaid' ? '' : status, unpaid: status === 'unpaid' ? 'true' : '', from, to };
  const { data, loading, reload } = useFetch(
    () => api.get<Paginated<Invoice>>('/invoices', { ...filters, page, limit: 15 }),
    [search, type, status, from, to, page],
  );

  const setFilter = (fn: (v: string) => void) => (v: string) => { fn(v); setPage(1); };

  const action = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); reload(); } catch (err) { setError(errorMessage(err)); }
  };

  const convert = (inv: Invoice) => action(async () => {
    if (!window.confirm(`Convertir la proforma ${inv.number} en facture ? Le stock sera mis à jour.`)) return;
    const created = await api.post<Invoice>(`/invoices/${inv._id}/convert`);
    navigate(`/invoice/${created._id}`);
  });

  const cancel = (inv: Invoice) => action(async () => {
    const reason = window.prompt(`Motif d'annulation de ${inv.number} :`);
    if (reason === null) return;
    await api.post(`/invoices/${inv._id}/cancel`, { reason });
  });

  const exportCsv = async () => {
    const all = await api.get<Paginated<Invoice>>('/invoices', { ...filters, limit: 200 });
    downloadCsv('factures.csv',
      ['Numéro', 'Type', 'Date', 'Échéance', 'Client', 'Devise', 'Sous-total', 'Remise', 'Total', 'Payé', 'Reste dû', 'Statut'],
      all.items.map((i) => [i.number, i.type, formatDate(i.issueDate), formatDate(i.dueDate), i.client, i.currency, i.subtotal, i.discount, i.totalAmount, i.amountPaid, i.balance, i.status]));
  };

  const isOverdue = (inv: Invoice) => inv.type === 'Facture' && inv.balance > 0 && !['Annulée', 'Convertie'].includes(inv.status) && inv.dueDate && new Date(inv.dueDate) < new Date();

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Factures & proformas"
        subtitle={data ? `${data.total} document(s)` : undefined}
        actions={<>
          <button className="btn btn-outline" onClick={exportCsv}><Download size={18} /> Exporter</button>
          <button className="btn btn-primary" onClick={() => navigate('/invoice')}><FilePlus2 size={18} /> Nouvelle</button>
        </>}
      />
      <Alert>{error}</Alert>

      <div className="toolbar card">
        <div className="search-box">
          <Search size={16} />
          <input className="input-field" placeholder="Numéro, client…" value={search} onChange={(e) => setFilter(setSearch)(e.target.value)} />
        </div>
        <select className="input-field" value={type} onChange={(e) => setFilter(setType)(e.target.value)}>
          <option value="">Tous les types</option>
          <option value="Facture">Factures</option>
          <option value="Proforma">Proformas</option>
        </select>
        <select className="input-field" value={status} onChange={(e) => setFilter(setStatus)(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="unpaid">Non soldées</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" className="input-field" value={from} onChange={(e) => setFilter(setFrom)(e.target.value)} aria-label="Du" />
        <input type="date" className="input-field" value={to} onChange={(e) => setFilter(setTo)(e.target.value)} aria-label="Au" />
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Numéro</th><th>Date</th><th>Échéance</th><th>Client</th><th className="num">Total</th><th className="num">Reste dû</th><th>Statut</th><th className="actions">Actions</th></tr>
            </thead>
            <tbody>
              {data?.items.map((inv) => (
                <tr key={inv._id}>
                  <td className="strong">
                    {inv.number}
                    <div className="muted small">{inv.type}</div>
                  </td>
                  <td className="muted">{formatDate(inv.issueDate)}</td>
                  <td className={isOverdue(inv) ? 'text-danger' : 'muted'}>{inv.type === 'Facture' ? formatDate(inv.dueDate) : '—'}</td>
                  <td>{inv.client}</td>
                  <td className="num strong">{formatMoney(inv.totalAmount, inv.currency)}</td>
                  <td className="num">{inv.type === 'Facture' && !['Annulée'].includes(inv.status) ? formatMoney(inv.balance, inv.currency) : '—'}</td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td className="actions">
                    <button className="icon-btn" title="Voir / imprimer" onClick={() => navigate(`/invoice/${inv._id}`)}><Printer size={17} /></button>
                    {inv.type === 'Facture' && inv.balance > 0 && !['Annulée', 'Convertie'].includes(inv.status) && (
                      <button className="icon-btn text-success" title="Encaisser" onClick={() => setPaying(inv)}><Wallet size={17} /></button>
                    )}
                    {inv.type === 'Proforma' && inv.status === 'En attente' && (
                      <button className="icon-btn text-primary" title="Convertir en facture" onClick={() => convert(inv)}><ArrowRightLeft size={17} /></button>
                    )}
                    {hasRole('admin', 'manager') && inv.status !== 'Annulée' && inv.status !== 'Convertie' && inv.amountPaid === 0 && (
                      <button className="icon-btn text-danger" title="Annuler" onClick={() => cancel(inv)}><Ban size={17} /></button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && data?.items.length === 0 && <EmptyRow colSpan={8}>Aucun document ne correspond à ces critères.</EmptyRow>}
            </tbody>
          </table>
        </div>
        {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
      </div>

      {paying && <PaymentModal invoice={paying} onClose={() => setPaying(null)} onSaved={reload} />}
    </div>
  );
}
