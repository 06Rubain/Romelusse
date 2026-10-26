import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, FilePlus2, Package } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { useAuth } from '../auth/AuthContext';
import { formatByCurrency, formatDate, formatMoney } from '../lib/format';
import type { Invoice, Paginated, Summary } from '../lib/types';
import { Alert, EmptyRow, PageHeader, StatCard, StatusBadge } from '../components/ui';
import MonthlyChart from '../components/MonthlyChart';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const summary = useFetch(() => api.get<Summary>('/reports/summary'), []);
  const recent = useFetch(() => api.get<Paginated<Invoice>>('/invoices', { limit: 8 }), []);
  const overdue = useFetch(() => api.get<Paginated<Invoice>>('/invoices', { overdue: 'true', limit: 5 }), []);
  const s = summary.data;
  const cur = s?.reportingCurrency || 'USD';

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Bonjour ${user?.displayName?.split(' ')[0] || ''}`.trim()}
        subtitle="Activité du mois en cours"
        actions={<button className="btn btn-primary" onClick={() => navigate('/invoice')}><FilePlus2 size={18} /> Nouvelle facture</button>}
      />
      <Alert>{summary.error}</Alert>

      <div className="stat-grid">
        <StatCard label="Facturé ce mois" value={formatMoney(s?.invoiced.total, cur)} hint={`${s?.invoiced.count ?? 0} facture(s) · ${formatByCurrency(s?.invoiced.byCurrency)}`} />
        <StatCard label="Encaissé ce mois" value={formatMoney(s?.collected.total, cur)} hint={formatByCurrency(s?.collected.byCurrency)} tone="success" />
        <StatCard label="Créances clients" value={formatMoney(s?.receivables.total, cur)} hint={`dont ${formatMoney(s?.overdue.total, cur)} en retard`} tone={s && s.overdue.total > 0 ? 'danger' : undefined} />
        {hasRole('admin', 'manager') ? (
          <StatCard label="Résultat (encaissé − dépenses)" value={formatMoney(s?.profit, cur)} hint={`Dépenses : ${formatMoney(s?.expenses?.total, cur)}`} tone={s && (s.profit ?? 0) < 0 ? 'danger' : 'success'} />
        ) : (
          <StatCard label="Proformas en attente" value={s?.counts.pendingProformas ?? 0} hint="à convertir en facture" />
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Évolution sur 12 mois <span className="muted small">({cur}, taux 1 USD = {s?.exchangeRate ?? '—'} FC)</span></h3>
          {s ? <MonthlyChart data={s.monthly} currency={cur} /> : <div className="muted">Chargement…</div>}
        </div>
        <div className="stack">
          <div className="card">
            <h3><AlertTriangle size={18} className="text-danger" /> Factures en retard</h3>
            <ul className="list">
              {overdue.data?.items.map((inv) => (
                <li key={inv._id}>
                  <Link to={`/invoice/${inv._id}`}>{inv.number} — {inv.client}</Link>
                  <span className="text-danger">{formatMoney(inv.balance, inv.currency)}</span>
                </li>
              ))}
              {overdue.data?.items.length === 0 && <li className="muted">Aucune facture en retard 🎉</li>}
            </ul>
          </div>
          <div className="card">
            <h3><Package size={18} /> Alertes de stock</h3>
            <ul className="list">
              {s?.lowStock.map((p) => (
                <li key={p._id}>
                  <Link to="/products">{p.name}</Link>
                  <span className={p.stockQuantity <= 0 ? 'text-danger' : 'text-warning'}>{p.stockQuantity} {p.unit} (min. {p.minStock})</span>
                </li>
              ))}
              {s?.lowStock.length === 0 && <li className="muted">Aucun produit sous le seuil.</li>}
            </ul>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Dernières factures</h3>
          <Link to="/invoices" className="muted">Tout voir →</Link>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Numéro</th><th>Date</th><th>Client</th><th>Type</th><th className="num">Total</th><th className="num">Reste dû</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {recent.data?.items.map((inv) => (
                <tr key={inv._id} className="clickable" onClick={() => navigate(`/invoice/${inv._id}`)}>
                  <td className="strong">{inv.number}</td>
                  <td className="muted">{formatDate(inv.issueDate)}</td>
                  <td>{inv.client}</td>
                  <td><span className={`badge ${inv.type === 'Proforma' ? 'badge-neutral' : 'badge-info'}`}>{inv.type}</span></td>
                  <td className="num strong">{formatMoney(inv.totalAmount, inv.currency)}</td>
                  <td className="num">{inv.type === 'Facture' && inv.status !== 'Annulée' ? formatMoney(inv.balance, inv.currency) : '—'}</td>
                  <td><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
              {recent.data?.items.length === 0 && <EmptyRow colSpan={7}>Aucune facture pour le moment.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
