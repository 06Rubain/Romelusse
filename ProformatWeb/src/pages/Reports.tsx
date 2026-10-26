import { useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { downloadCsv, formatByCurrency, formatMoney, monthLabel, toInputDate } from '../lib/format';
import type { Summary } from '../lib/types';
import { Alert, PageHeader, StatCard } from '../components/ui';
import MonthlyChart from '../components/MonthlyChart';

const now = new Date();
const PRESETS = {
  month: { label: 'Ce mois', from: new Date(now.getFullYear(), now.getMonth(), 1) },
  quarter: { label: 'Ce trimestre', from: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1) },
  year: { label: 'Cette année', from: new Date(now.getFullYear(), 0, 1) },
};

export default function Reports() {
  const [preset, setPreset] = useState<string>('month');
  const [from, setFrom] = useState(toInputDate(PRESETS.month.from));
  const [to, setTo] = useState(toInputDate(now));
  const { data: s, error } = useFetch(() => api.get<Summary>('/reports/summary', { from, to }), [from, to]);
  const cur = s?.reportingCurrency || 'USD';

  const exportMonthly = () => s && downloadCsv('rapport-mensuel.csv', ['Mois', `Facturé (${cur})`, `Encaissé (${cur})`, `Dépenses (${cur})`, `Résultat (${cur})`],
    s.monthly.map((m) => [m.month, m.invoiced, m.collected, m.expenses ?? '', m.expenses !== null ? Math.round((m.collected - m.expenses) * 100) / 100 : '']));

  return (
    <div className="animate-fade-in">
      <PageHeader title="Rapports" subtitle={s ? `Montants consolidés en ${cur} (1 USD = ${s.exchangeRate} FC)` : undefined}
        actions={<button className="btn btn-outline" onClick={exportMonthly}><Download size={18} /> Exporter</button>} />
      <Alert>{error}</Alert>

      <div className="toolbar card">
        {Object.entries(PRESETS).map(([key, p]) => (
          <button key={key} className={`btn btn-sm ${preset === key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setPreset(key); setFrom(toInputDate(p.from)); setTo(toInputDate(now)); }}>{p.label}</button>
        ))}
        <input type="date" className="input-field" value={from} onChange={(e) => { setPreset(''); setFrom(e.target.value); }} aria-label="Du" />
        <input type="date" className="input-field" value={to} onChange={(e) => { setPreset(''); setTo(e.target.value); }} aria-label="Au" />
      </div>

      <div className="stat-grid">
        <StatCard label="Chiffre d'affaires facturé" value={formatMoney(s?.invoiced.total, cur)} hint={`${s?.invoiced.count ?? 0} facture(s) · ${formatByCurrency(s?.invoiced.byCurrency)}`} />
        <StatCard label="Encaissements" value={formatMoney(s?.collected.total, cur)} hint={formatByCurrency(s?.collected.byCurrency)} tone="success" />
        <StatCard label="Dépenses" value={formatMoney(s?.expenses?.total, cur)} hint={formatByCurrency(s?.expenses?.byCurrency)} />
        <StatCard label="Résultat de trésorerie" value={formatMoney(s?.profit, cur)} hint="encaissements − dépenses" tone={(s?.profit ?? 0) < 0 ? 'danger' : 'success'} />
        <StatCard label="Créances en cours" value={formatMoney(s?.receivables.total, cur)} hint={`${s?.receivables.count ?? 0} facture(s) non soldée(s)`} />
        <StatCard label="Dont en retard" value={formatMoney(s?.overdue.total, cur)} hint={`${s?.overdue.count ?? 0} facture(s)`} tone={(s?.overdue.total ?? 0) > 0 ? 'danger' : undefined} />
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Évolution sur 12 mois</h3>
        {s && <MonthlyChart data={s.monthly} currency={cur} />}
        <details style={{ marginTop: 12 }}>
          <summary className="muted">Voir le tableau</summary>
          <div className="table-container">
            <table>
              <thead><tr><th>Mois</th><th className="num">Facturé</th><th className="num">Encaissé</th><th className="num">Dépenses</th><th className="num">Résultat</th></tr></thead>
              <tbody>
                {s?.monthly.map((m) => (
                  <tr key={m.month}>
                    <td>{monthLabel(m.month)}</td>
                    <td className="num">{formatMoney(m.invoiced, cur)}</td>
                    <td className="num">{formatMoney(m.collected, cur)}</td>
                    <td className="num">{formatMoney(m.expenses, cur)}</td>
                    <td className={`num strong ${m.collected - (m.expenses || 0) < 0 ? 'text-danger' : ''}`}>{formatMoney(m.collected - (m.expenses || 0), cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      <div className="grid-2 even">
        <div className="card">
          <h3>Meilleurs clients</h3>
          <table>
            <thead><tr><th>Client</th><th className="num">Factures</th><th className="num">Montant</th></tr></thead>
            <tbody>
              {s?.topClients.map((c) => <tr key={c.name}><td>{c.name}</td><td className="num">{c.count}</td><td className="num strong">{formatMoney(c.total, cur)}</td></tr>)}
              {s?.topClients.length === 0 && <tr><td colSpan={3} className="empty-cell">Aucune vente sur la période.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Produits les plus vendus</h3>
          <table>
            <thead><tr><th>Produit</th><th className="num">Quantité</th><th className="num">Montant</th></tr></thead>
            <tbody>
              {s?.topProducts.map((p) => <tr key={p.name}><td>{p.name}</td><td className="num">{p.quantity}</td><td className="num strong">{formatMoney(p.total, cur)}</td></tr>)}
              {s?.topProducts.length === 0 && <tr><td colSpan={3} className="empty-cell">Aucune vente sur la période.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
