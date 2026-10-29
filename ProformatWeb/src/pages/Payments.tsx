import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { downloadCsv, formatDate, formatMoney } from '../lib/format';
import { PAYMENT_METHODS, type Paginated, type Payment } from '../lib/types';
import { EmptyRow, PageHeader, Pagination } from '../components/ui';

export default function Payments() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filters = { search, method, from, to };
  const { data, loading } = useFetch(() => api.get<Paginated<Payment>>('/payments', { ...filters, page }), [search, method, from, to, page]);

  const totals = (data?.items || []).reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.currency]: (acc[p.currency] || 0) + p.amount }), {});

  const exportCsv = async () => {
    const all = await api.get<Paginated<Payment>>('/payments', { ...filters, limit: 200 });
    downloadCsv('encaissements.csv', ['Date', 'Facture', 'Client', 'Mode', 'Référence', 'Montant', 'Devise', 'Saisi par'],
      all.items.map((p) => [formatDate(p.date), p.invoiceNumber, p.client, p.method, p.reference, p.amount, p.currency, p.createdBy]));
  };

  const filter = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { fn(e.target.value); setPage(1); };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Encaissements" subtitle="Journal de tous les paiements reçus"
        actions={<button className="btn btn-outline" onClick={exportCsv}><Download size={18} /> Exporter</button>} />
      <div className="toolbar card">
        <div className="search-box"><Search size={16} /><input className="input-field" placeholder="Facture, client, référence…" value={search} onChange={filter(setSearch)} /></div>
        <select className="input-field" value={method} onChange={filter(setMethod)}>
          <option value="">Tous les modes</option>
          {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
        </select>
        <input type="date" className="input-field" value={from} onChange={filter(setFrom)} aria-label="Du" />
        <input type="date" className="input-field" value={to} onChange={filter(setTo)} aria-label="Au" />
      </div>
      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr><th>Date</th><th>Facture</th><th>Client</th><th>Mode</th><th>Référence</th><th className="num">Montant</th><th>Saisi par</th></tr></thead>
            <tbody>
              {data?.items.map((p) => (
                <tr key={p._id}>
                  <td className="muted">{formatDate(p.date)}</td>
                  <td><Link to={`/invoice/${p.invoice}`}>{p.invoiceNumber}</Link></td>
                  <td>{p.client}</td>
                  <td>{p.method}</td>
                  <td className="muted">{p.reference || '—'}</td>
                  <td className="num strong text-success">{formatMoney(p.amount, p.currency)}</td>
                  <td className="muted small">{p.createdBy}</td>
                </tr>
              ))}
              {!loading && data?.items.length === 0 && <EmptyRow colSpan={7}>Aucun encaissement.</EmptyRow>}
            </tbody>
          </table>
        </div>
        {Object.keys(totals).length > 0 && (
          <div className="muted small" style={{ marginTop: 12 }}>Total de la page : {Object.entries(totals).map(([c, v]) => formatMoney(v, c)).join(' · ')}</div>
        )}
        {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
      </div>
    </div>
  );
}
