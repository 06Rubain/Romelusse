import { useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { formatDateTime } from '../lib/format';
import type { Activity, Paginated } from '../lib/types';
import { EmptyRow, PageHeader, Pagination } from '../components/ui';

export default function Activities({ endpoint = '/activities', title = 'Journal d\'activité' }: { endpoint?: string; title?: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { data, loading } = useFetch(() => api.get<Paginated<Activity>>(endpoint, { search, page }), [endpoint, search, page]);
  return (
    <div className="animate-fade-in">
      <PageHeader title={title} subtitle="Traçabilité des connexions et des opérations" />
      <div className="toolbar card">
        <div className="search-box"><Search size={16} /><input className="input-field" placeholder="Utilisateur, action, détail…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
      </div>
      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Détails</th></tr></thead>
            <tbody>
              {data?.items.map((a) => (
                <tr key={a._id}>
                  <td className="muted">{formatDateTime(a.date)}</td>
                  <td className="strong">{a.userEmail}</td>
                  <td><span className={`badge ${a.action === 'Connexion' ? 'badge-success' : 'badge-info'}`}>{a.action}</span></td>
                  <td className="muted small">{a.details}</td>
                </tr>
              ))}
              {!loading && data?.items.length === 0 && <EmptyRow colSpan={4}>Aucune activité.</EmptyRow>}
            </tbody>
          </table>
        </div>
        {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
      </div>
    </div>
  );
}
