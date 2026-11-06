import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../lib/format';
import type { DeliveryNote, Paginated } from '../lib/types';
import { EmptyRow, PageHeader, Pagination } from '../components/ui';

// Liste des bons de livraison de l'entreprise
export default function Deliveries() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, loading } = useFetch(() => api.get<Paginated<DeliveryNote>>('/deliveries', { search, from, to, page }), [search, from, to, page]);
  const filter = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { fn(e.target.value); setPage(1); };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Bons de livraison" subtitle="Ce qui a été remis aux clients, quantités commandées et livrées"
        actions={can('invoices.create') ? <Link to="/delivery/new" className="btn btn-primary"><Plus size={18} /> Livraison libre</Link> : undefined} />
      <p className="muted small" style={{ marginTop: -8 }}>Pour livrer une facture ou un bon de commande, ouvrez-le et cliquez sur « Bon de livraison ».</p>
      <div className="toolbar card">
        <div className="search-box"><Search size={16} /><input className="input-field" placeholder="Numéro, client, facture…" value={search} onChange={filter(setSearch)} /></div>
        <input type="date" className="input-field" value={from} onChange={filter(setFrom)} aria-label="Du" />
        <input type="date" className="input-field" value={to} onChange={filter(setTo)} aria-label="Au" />
      </div>
      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr><th>Numéro</th><th>Date</th><th>Client</th><th>Document</th><th className="num">Articles livrés</th><th>Statut</th></tr></thead>
            <tbody>
              {data?.items.map((d) => (
                <tr key={d._id}>
                  <td><Link to={`/delivery/${d._id}`} className="strong">{d.number}</Link></td>
                  <td className="muted">{formatDate(d.date)}</td>
                  <td>{d.client}</td>
                  <td>{d.invoice ? <Link to={`/invoice/${d.invoice}`}>{d.invoiceNumber}</Link> : <span className="muted">Livraison libre</span>}</td>
                  <td className="num strong">{d.lines.reduce((s, l) => s + l.delivered, 0).toLocaleString('fr-FR')}</td>
                  <td><span className={`badge ${d.status === 'Annulé' ? 'badge-danger' : 'badge-success'}`}>{d.status}</span></td>
                </tr>
              ))}
              {!loading && data?.items.length === 0 && <EmptyRow colSpan={6}>Aucun bon de livraison.</EmptyRow>}
            </tbody>
          </table>
        </div>
        {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
      </div>
    </div>
  );
}
