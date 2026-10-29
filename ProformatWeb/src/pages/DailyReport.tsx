import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MessageCircle, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { formatByCurrency, formatDate, formatMoney, toInputDate } from '../lib/format';
import type { Currency } from '../lib/types';
import { Alert, EmptyRow, PageHeader, StatusBadge } from '../components/ui';
import type { InvoiceStatus } from '../lib/types';

type Account = 'Caisse' | 'Mobile Money' | 'Banque';
type Money = Record<Currency, number>;
interface Daily {
  date: string;
  company: { name: string; exchangeRate: number; reportingCurrency: Currency };
  totals: { in: Money; out: Money; invoiced: Money; proforma: Money };
  byAccount: Record<Account, { in: Money; out: Money }>;
  opening: Record<Account, Money>;
  closing: Record<Account, Money>;
  invoices: { _id: string; number: string; type: 'Proforma' | 'Facture'; client: string; totalAmount: number; currency: Currency; status: InvoiceStatus; createdBy: string }[];
  entries: { _id: string; kind: string; date: string; amount: number; currency: Currency; account: Account; toAccount?: Account; label: string; detail?: string; invoice?: string }[];
  topProducts: { name: string; currency: Currency; quantity: number; total: number }[];
}

const ACCOUNTS: Account[] = ['Caisse', 'Mobile Money', 'Banque'];

const shiftDay = (day: string, delta: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return toInputDate(d);
};

// Montants USD et FC sur deux lignes, en masquant la devise vide si l'autre est renseignée
function Amounts({ value, sign = '' }: { value: Money; sign?: string }) {
  const parts = (['USD', 'FC'] as const).filter((c) => value[c]);
  if (!parts.length) return <span className="muted">—</span>;
  return <>{parts.map((c) => <div key={c}>{sign}{formatMoney(value[c], c)}</div>)}</>;
}

const whatsappText = (r: Daily) => {
  const line = (m: Money) => formatByCurrency(m);
  const net: Money = { USD: r.totals.in.USD - r.totals.out.USD, FC: r.totals.in.FC - r.totals.out.FC };
  return [
    `*Rapport du ${formatDate(r.date)} — ${r.company.name}*`,
    `Documents : ${r.invoices.filter((i) => i.type === 'Facture').length} facture(s), ${r.invoices.filter((i) => i.type === 'Proforma').length} proforma(s)`,
    `Facturé : ${line(r.totals.invoiced)}`,
    `Encaissé : ${line(r.totals.in)}`,
    `Dépensé : ${line(r.totals.out)}`,
    `Résultat du jour : ${line(net)}`,
    '',
    '*Soldes en fin de journée*',
    ...ACCOUNTS.map((a) => `${a} : ${formatByCurrency(r.closing[a])}`),
  ].join('\n');
};

export default function DailyReport() {
  const [day, setDay] = useState(toInputDate());
  const { data: r, error, loading } = useFetch(() => api.get<Daily>('/treasury/daily', { date: day }), [day]);
  const isToday = day === toInputDate();
  const net: Money | null = r ? { USD: r.totals.in.USD - r.totals.out.USD, FC: r.totals.in.FC - r.totals.out.FC } : null;
  const factures = r?.invoices.filter((i) => i.type === 'Facture').length ?? 0;
  const proformas = r?.invoices.filter((i) => i.type === 'Proforma').length ?? 0;

  return (
    <div className="animate-fade-in daily-report">
      <PageHeader title="Rapport du jour" subtitle={r ? `${r.company.name} · ${new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}` : undefined}
        actions={<div className="row-gap no-print">
          <button className="btn btn-outline" onClick={() => window.print()} disabled={!r}><Printer size={18} /> Imprimer</button>
          {r && <a className="btn btn-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(whatsappText(r))}`} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp</a>}
        </div>} />

      <div className="day-picker no-print">
        <button className="btn btn-outline btn-sm" onClick={() => setDay(shiftDay(day, -1))} aria-label="Jour précédent"><ChevronLeft size={18} /></button>
        <input type="date" className="input-field" value={day} max={toInputDate()} onChange={(e) => e.target.value && setDay(e.target.value)} />
        <button className="btn btn-outline btn-sm" onClick={() => setDay(shiftDay(day, 1))} disabled={isToday} aria-label="Jour suivant"><ChevronRight size={18} /></button>
        {!isToday && <button className="btn btn-ghost btn-sm" onClick={() => setDay(toInputDate())}>Aujourd'hui</button>}
      </div>
      <Alert>{error}</Alert>

      {r && net && (
        <>
          <div className="stat-grid">
            <div className="card stat-card"><div className="muted small">Facturé</div><div className="stat-value"><Amounts value={r.totals.invoiced} /></div><div className="muted small">{factures} facture(s) · {proformas} proforma(s)</div></div>
            <div className="card stat-card"><div className="muted small">Encaissé (entrées)</div><div className="stat-value text-success"><Amounts value={r.totals.in} sign="+ " /></div></div>
            <div className="card stat-card"><div className="muted small">Dépensé (sorties)</div><div className="stat-value text-danger"><Amounts value={r.totals.out} sign="− " /></div></div>
            <div className="card stat-card"><div className="muted small">Résultat du jour</div><div className={`stat-value ${net.USD < 0 || net.FC < 0 ? 'text-danger' : ''}`}><Amounts value={net} /></div></div>
          </div>

          <div className="card">
            <h3>Caisse et comptes</h3>
            <div className="table-container">
              <table>
                <thead><tr><th>Compte</th><th className="num">Début de journée</th><th className="num">Entrées</th><th className="num">Sorties</th><th className="num">Fin de journée</th></tr></thead>
                <tbody>
                  {ACCOUNTS.map((a) => (
                    <tr key={a}>
                      <td className="strong">{a}</td>
                      <td className="num"><Amounts value={r.opening[a]} /></td>
                      <td className="num text-success"><Amounts value={r.byAccount[a].in} sign="+ " /></td>
                      <td className="num text-danger"><Amounts value={r.byAccount[a].out} sign="− " /></td>
                      <td className="num strong"><Amounts value={r.closing[a]} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid-2 even daily-grid">
            <div className="card">
              <h3>Documents émis ({r.invoices.length})</h3>
              <div className="table-container">
                <table>
                  <thead><tr><th>Numéro</th><th>Client</th><th className="num">Montant</th><th>Statut</th></tr></thead>
                  <tbody>
                    {r.invoices.map((i) => (
                      <tr key={i._id}>
                        <td className="strong"><Link to={`/invoice/${i._id}`}>{i.number}</Link><div className="muted small">{i.type}</div></td>
                        <td>{i.client}</td>
                        <td className="num">{formatMoney(i.totalAmount, i.currency)}</td>
                        <td><StatusBadge status={i.status} /></td>
                      </tr>
                    ))}
                    {r.invoices.length === 0 && <EmptyRow colSpan={4}>Aucun document ce jour-là.</EmptyRow>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <h3>Produits vendus</h3>
              <div className="table-container">
                <table>
                  <thead><tr><th>Produit</th><th className="num">Quantité</th><th className="num">Montant</th></tr></thead>
                  <tbody>
                    {r.topProducts.map((p) => (
                      <tr key={`${p.name}-${p.currency}`}><td>{p.name}</td><td className="num">{p.quantity}</td><td className="num">{formatMoney(p.total, p.currency)}</td></tr>
                    ))}
                    {r.topProducts.length === 0 && <EmptyRow colSpan={3}>Aucune vente facturée ce jour-là.</EmptyRow>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 24 }}>
            <h3>Mouvements d'argent ({r.entries.length})</h3>
            <div className="table-container">
              <table>
                <thead><tr><th>Opération</th><th>Compte</th><th className="num">Entrée</th><th className="num">Sortie</th></tr></thead>
                <tbody>
                  {r.entries.map((e) => (
                    <tr key={`${e.kind}-${e._id}`}>
                      <td><div className="strong">{e.invoice ? <Link to={`/invoice/${e.invoice}`}>{e.label}</Link> : e.label}</div>{e.detail && <div className="muted small">{e.detail}</div>}</td>
                      <td><span className="badge badge-neutral">{e.kind === 'transfer' ? `${e.account} → ${e.toAccount}` : e.account}</span></td>
                      <td className="num text-success strong">{e.kind !== 'transfer' && e.amount > 0 ? `+ ${formatMoney(e.amount, e.currency)}` : e.kind === 'transfer' ? formatMoney(e.amount, e.currency) : ''}</td>
                      <td className="num text-danger strong">{e.amount < 0 ? `− ${formatMoney(-e.amount, e.currency)}` : ''}</td>
                    </tr>
                  ))}
                  {r.entries.length === 0 && <EmptyRow colSpan={4}>Aucun mouvement d'argent ce jour-là.</EmptyRow>}
                </tbody>
              </table>
            </div>
          </div>
          <p className="muted small print-only">Rapport généré le {new Date().toLocaleString('fr-FR')} · OmniCom Facturation</p>
        </>
      )}
      {loading && !r && <div className="muted">Chargement…</div>}
    </div>
  );
}
