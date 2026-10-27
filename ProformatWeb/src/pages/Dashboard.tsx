import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, FilePlus2, FileText, Package, PiggyBank, Receipt, UserPlus, Wallet, X } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { useAuth } from '../auth/AuthContext';
import { formatByCurrency, formatDate, formatMoney } from '../lib/format';
import type { Invoice, Paginated, Summary } from '../lib/types';
import { Alert, EmptyRow, PageHeader, StatCard, StatusBadge } from '../components/ui';
import MonthlyChart from '../components/MonthlyChart';

const onboardingKey = (companyId?: string) => `onboarding-hidden:${companyId || ''}`;

const readHidden = (companyId?: string) => {
  try { return localStorage.getItem(onboardingKey(companyId)) === '1'; } catch { return false; }
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, company, can } = useAuth();
  const [onboardingHidden, setOnboardingHidden] = useState(() => readHidden(company?._id));
  const summary = useFetch(() => api.get<Summary>('/reports/summary'), []);
  const recent = useFetch(() => api.get<Paginated<Invoice>>('/invoices', { limit: 8 }), []);
  const overdue = useFetch(() => api.get<Paginated<Invoice>>('/invoices', { overdue: 'true', limit: 5 }), []);
  const s = summary.data;
  const cur = s?.reportingCurrency || 'USD';

  const quickActions = [
    { to: '/invoice?type=Facture', label: 'Nouvelle facture', hint: 'Facturer un client', icon: FilePlus2, tone: '', show: can('invoices.create') },
    { to: '/invoice', label: 'Nouvelle proforma', hint: 'Envoyer un devis', icon: FileText, tone: 'purple', show: can('invoices.create') },
    { to: '/invoices?status=unpaid', label: 'Encaisser', hint: 'Factures à régler', icon: Wallet, tone: 'green', show: can('payments.create') },
    { to: '/expenses?new=1', label: 'Dépense', hint: 'L\'argent qui sort', icon: Receipt, tone: 'orange', show: can('expenses.manage') },
    { to: '/treasury', label: 'Trésorerie', hint: 'Caisse, Mobile Money, banque', icon: PiggyBank, tone: 'purple', show: can('payments.create', 'expenses.manage', 'reports.view') },
    { to: '/clients?new=1', label: 'Nouveau client', hint: 'Ajouter une fiche', icon: UserPlus, tone: '', show: can('clients.manage') },
  ].filter((a) => a.show);

  // Premiers pas, affichés aux administrateurs tant que tout n'est pas fait
  const steps = s ? [
    { label: 'Ajouter votre logo', hint: 'Il apparaîtra sur vos documents', to: '/settings', done: Boolean(company?.logo) },
    { label: 'Créer votre catalogue', hint: 'Produits et services avec leurs prix', to: '/products', done: s.counts.products > 0 },
    { label: 'Inviter votre équipe', hint: 'Un compte par collaborateur', to: '/users', done: s.counts.users > 1 },
    { label: 'Émettre votre premier document', hint: 'Proforma ou facture', to: '/invoice', done: s.counts.invoices > 0 },
  ] : [];
  const doneCount = steps.filter((x) => x.done).length;
  const showOnboarding = can('settings.manage') && steps.length > 0 && doneCount < steps.length && !onboardingHidden;
  const hideOnboarding = () => {
    try { localStorage.setItem(onboardingKey(company?._id), '1'); } catch { /* stockage indisponible */ }
    setOnboardingHidden(true);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Bonjour ${user?.displayName?.split(' ')[0] || ''}`.trim()}
        subtitle="Que voulez-vous faire aujourd'hui ?"
      />
      <Alert>{summary.error}</Alert>

      {quickActions.length > 0 && (
        <div className="quick-actions">
          {quickActions.map(({ to, label, hint, icon: Icon, tone }) => (
            <Link key={to} to={to} className="quick-action">
              <span className={`qa-icon ${tone}`}><Icon size={20} /></span>
              <span><strong>{label}</strong><small>{hint}</small></span>
            </Link>
          ))}
        </div>
      )}

      {showOnboarding && (
        <div className="card onboarding">
          <div className="card-header">
            <div>
              <h3 style={{ margin: 0 }}>Bien démarrer</h3>
              <span className="muted small">{doneCount} étape{doneCount > 1 ? 's' : ''} sur {steps.length} terminée{doneCount > 1 ? 's' : ''}</span>
            </div>
            <button className="icon-btn" onClick={hideOnboarding} title="Masquer" aria-label="Masquer le guide"><X size={18} /></button>
          </div>
          <div className="onboarding-progress"><span style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
          <div className="onboarding-steps">
            {steps.map((step, i) => (
              <Link key={step.to} to={step.to} className={`onboarding-step ${step.done ? 'done' : ''}`}>
                <span className="dot">{step.done ? <Check size={14} /> : i + 1}</span>
                <span><strong>{step.label}</strong><br /><small className="muted">{step.hint}</small></span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <h3 className="section-title">Ce mois-ci</h3>

      <div className="stat-grid">
        <StatCard label="Facturé ce mois" value={formatMoney(s?.invoiced.total, cur)} hint={`${s?.invoiced.count ?? 0} facture(s) · ${formatByCurrency(s?.invoiced.byCurrency)}`} />
        <StatCard label="Encaissé ce mois" value={formatMoney(s?.collected.total, cur)} hint={formatByCurrency(s?.collected.byCurrency)} tone="success" />
        <StatCard label="Créances clients" value={formatMoney(s?.receivables.total, cur)} hint={`dont ${formatMoney(s?.overdue.total, cur)} en retard`} tone={s && s.overdue.total > 0 ? 'danger' : undefined} />
        {can('reports.view') ? (
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
              {recent.data?.items.length === 0 && <EmptyRow colSpan={7}>Aucune facture pour le moment : utilisez « Nouvelle facture » ci-dessus pour commencer.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
