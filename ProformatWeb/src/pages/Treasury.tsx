import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Banknote, Landmark, Minus, PiggyBank, Plus, Smartphone, Trash2, Wallet, type LucideIcon } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useFeedback } from '../components/feedback';
import { useFetch } from '../lib/useFetch';
import { convertAmount, formatDate, formatMoney, toInputDate } from '../lib/format';
import type { Currency } from '../lib/types';
import { Alert, EmptyRow, EmptyState, Field, Modal, PageHeader } from '../components/ui';

type Account = 'Caisse' | 'Mobile Money' | 'Banque';
type MovementType = 'in' | 'transfer' | 'opening';

interface Entry {
  _id: string; kind: 'payment' | 'expense' | 'in' | 'transfer' | 'opening'; date: string; amount: number; currency: Currency;
  account: Account; toAccount?: Account; label: string; detail?: string; invoice?: string; deletable?: boolean;
}
interface TreasuryData {
  accounts: Account[];
  balances: Record<Account, Record<Currency, number>>;
  period: { in: Record<Currency, number>; out: Record<Currency, number> };
  entries: Entry[];
  truncated: boolean;
  exchangeRate: number;
  reportingCurrency: Currency;
}

const ACCOUNTS: Account[] = ['Caisse', 'Mobile Money', 'Banque'];
const ACCOUNT_INFO: Record<Account, { icon: LucideIcon; hint: string; tone: string }> = {
  Caisse: { icon: Banknote, hint: 'Espèces', tone: 'green' },
  'Mobile Money': { icon: Smartphone, hint: 'M-Pesa, Airtel, Orange…', tone: 'orange' },
  Banque: { icon: Landmark, hint: 'Virements, chèques, cartes', tone: 'purple' },
};

const PERIODS = [
  { key: 'today', label: 'Aujourd\'hui' },
  { key: 'week', label: '7 jours' },
  { key: 'month', label: 'Ce mois' },
  { key: 'all', label: 'Tout' },
] as const;
type Period = typeof PERIODS[number]['key'];

const periodRange = (period: Period) => {
  const now = new Date();
  if (period === 'all') return {};
  const start = new Date(now);
  if (period === 'week') start.setDate(now.getDate() - 6);
  if (period === 'month') start.setDate(1);
  return { from: toInputDate(start), to: toInputDate(now) };
};

const MOVEMENT_TITLES: Record<MovementType, string> = {
  in: 'Entrée d\'argent',
  transfer: 'Virement entre comptes',
  opening: 'Solde de départ',
};

interface MovementForm { type: MovementType; account: Account; toAccount: Account; amount: string; currency: Currency; date: string; label: string }

export default function Treasury() {
  const { can } = useAuth();
  const { confirm, toast } = useFeedback();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('month');
  const [account, setAccount] = useState<Account | ''>('');
  const [form, setForm] = useState<MovementForm | null>(null);
  const [error, setError] = useState('');
  const range = periodRange(period);
  const { data, loading, reload } = useFetch(() => api.get<TreasuryData>('/treasury', { ...range, account }), [period, account]);
  const canMove = can('payments.create', 'expenses.manage');

  const open = (type: MovementType) => {
    setError('');
    setForm({ type, account: type === 'transfer' ? 'Caisse' : account || 'Caisse', toAccount: 'Banque', amount: '', currency: 'USD', date: toInputDate(), label: '' });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError('');
    try {
      await api.post('/treasury/movements', { ...form, amount: parseFloat(form.amount.replace(',', '.')) });
      toast(`${MOVEMENT_TITLES[form.type]} enregistré${form.type === 'in' ? 'e' : ''}.`);
      setForm(null);
      reload();
    } catch (err) { setError(errorMessage(err)); }
  };

  const remove = async (entry: Entry) => {
    if (!(await confirm({ title: 'Supprimer ce mouvement ?', message: `${entry.label} — ${formatMoney(Math.abs(entry.amount), entry.currency)}`, confirmLabel: 'Supprimer', danger: true }))) return;
    try { await api.del(`/treasury/movements/${entry._id}`); toast('Mouvement supprimé.'); reload(); } catch (err) { toast(errorMessage(err), 'error'); }
  };

  const rate = data?.exchangeRate || 0;
  const cur = data?.reportingCurrency || 'USD';
  const total = data ? ACCOUNTS.reduce((sum, a) => sum + convertAmount(data.balances[a].USD, 'USD', cur, rate) + convertAmount(data.balances[a].FC, 'FC', cur, rate), 0) : 0;
  // Sans filtre de compte, un virement interne n'est ni une entrée ni une sortie
  const isIn = (e: Entry) => e.amount > 0 && (e.kind !== 'transfer' || Boolean(account));
  const net = (c: Currency) => (data ? data.period.in[c] - data.period.out[c] : 0);
  const hasMoney = data && (data.entries.length > 0 || ACCOUNTS.some((a) => data.balances[a].USD || data.balances[a].FC));

  return (
    <div className="animate-fade-in">
      <PageHeader title="Trésorerie" subtitle="Où est votre argent, ce qui entre et ce qui sort"
        actions={canMove && <>
          <button className="btn btn-outline" onClick={() => open('transfer')}><ArrowLeftRight size={18} /> Virement</button>
          <button className="btn btn-primary" onClick={() => open('in')}><Plus size={18} /> Entrée d'argent</button>
        </>} />

      <div className="money-grid">
        <div className="card money-total">
          <span className="muted small">Total disponible</span>
          <strong>{formatMoney(total, cur)}</strong>
          <span className="muted small">{cur === 'USD' ? `FC convertis à 1 USD = ${rate} FC` : `USD convertis à 1 USD = ${rate} FC`}</span>
        </div>
        {ACCOUNTS.map((a) => {
          const { icon: Icon, hint, tone } = ACCOUNT_INFO[a];
          const b = data?.balances[a];
          return (
            <button key={a} type="button" className={`card money-account ${account === a ? 'selected' : ''}`} onClick={() => setAccount(account === a ? '' : a)}>
              <span className={`qa-icon ${tone}`}><Icon size={20} /></span>
              <span className="money-account-body">
                <span className="strong">{a}</span>
                <small className="muted">{hint}</small>
                <span className={`money-line ${b && b.USD < 0 ? 'text-danger' : ''}`}>{formatMoney(b?.USD, 'USD')}</span>
                <span className={`money-line ${b && b.FC < 0 ? 'text-danger' : ''}`}>{formatMoney(b?.FC, 'FC')}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="quick-actions money-actions">
        {can('payments.create') && (
          <Link to="/invoices?status=unpaid" className="quick-action"><span className="qa-icon green"><Wallet size={20} /></span><span><strong>Encaisser une facture</strong><small>Le client paie</small></span></Link>
        )}
        {can('expenses.manage') && (
          <button type="button" className="quick-action" onClick={() => navigate('/expenses?new=1')}><span className="qa-icon orange"><Minus size={20} /></span><span><strong>Nouvelle dépense</strong><small>L'argent sort</small></span></button>
        )}
        {canMove && (
          <button type="button" className="quick-action" onClick={() => open('in')}><span className="qa-icon"><Plus size={20} /></span><span><strong>Autre entrée</strong><small>Apport, vente au comptoir…</small></span></button>
        )}
        {canMove && (
          <button type="button" className="quick-action" onClick={() => open('opening')}><span className="qa-icon purple"><PiggyBank size={20} /></span><span><strong>Solde de départ</strong><small>Argent déjà présent</small></span></button>
        )}
      </div>

      <div className="card">
        <div className="card-header money-filters">
          <div className="choice-chips">
            {PERIODS.map((p) => <button key={p.key} type="button" className={period === p.key ? 'active' : ''} onClick={() => setPeriod(p.key)}>{p.label}</button>)}
          </div>
          <div className="choice-chips">
            <button type="button" className={account === '' ? 'active' : ''} onClick={() => setAccount('')}>Tous les comptes</button>
            {ACCOUNTS.map((a) => <button key={a} type="button" className={account === a ? 'active' : ''} onClick={() => setAccount(a)}>{a}</button>)}
          </div>
        </div>

        <div className="money-period">
          <div><span className="muted small">Entrées</span><strong className="text-success">+ {formatMoney(data?.period.in.USD, 'USD')}</strong><small className="text-success">+ {formatMoney(data?.period.in.FC, 'FC')}</small></div>
          <div><span className="muted small">Sorties</span><strong className="text-danger">− {formatMoney(data?.period.out.USD, 'USD')}</strong><small className="text-danger">− {formatMoney(data?.period.out.FC, 'FC')}</small></div>
          <div><span className="muted small">Résultat de la période</span><strong className={net('USD') < 0 ? 'text-danger' : ''}>{formatMoney(net('USD'), 'USD')}</strong><small className={net('FC') < 0 ? 'text-danger' : 'muted'}>{formatMoney(net('FC'), 'FC')}</small></div>
        </div>

        <div className="table-container">
          <table className="money-table">
            <thead><tr><th>Date</th><th>Opération</th><th className="wide-only">Compte</th><th className="num wide-only">Entrée</th><th className="num wide-only">Sortie</th><th className="actions" /></tr></thead>
            <tbody>
              {data?.entries.map((e) => (
                <tr key={`${e.kind}-${e._id}`}>
                  <td className="muted">{formatDate(e.date)}</td>
                  <td>
                    <div className="strong">{e.invoice ? <Link to={`/invoice/${e.invoice}`}>{e.label}</Link> : e.label}</div>
                    {e.detail && <div className="muted small">{e.detail}</div>}
                    <div className={`narrow-only strong ${e.amount < 0 ? 'text-danger' : isIn(e) ? 'text-success' : 'muted'}`}>
                      {e.amount < 0 ? '− ' : isIn(e) ? '+ ' : ''}{formatMoney(Math.abs(e.amount), e.currency)} · {e.kind === 'transfer' ? `${e.account} → ${e.toAccount}` : e.account}
                    </div>
                  </td>
                  <td className="wide-only"><span className="badge badge-neutral">{e.kind === 'transfer' ? `${e.account} → ${e.toAccount}` : e.account}</span></td>
                  <td className="num text-success strong wide-only">{isIn(e) ? `+ ${formatMoney(e.amount, e.currency)}` : ''}</td>
                  <td className="num text-danger strong wide-only">{e.amount < 0 ? `− ${formatMoney(-e.amount, e.currency)}` : ''}</td>
                  <td className="actions">
                    {e.kind === 'transfer' && !account && <span className="muted small">{formatMoney(e.amount, e.currency)}</span>}
                    {e.deletable && canMove && <button className="icon-btn text-danger" title="Supprimer" onClick={() => remove(e)}><Trash2 size={16} /></button>}
                  </td>
                </tr>
              ))}
              {!loading && data?.entries.length === 0 && (
                <EmptyRow colSpan={6}>
                  {hasMoney || period !== 'all' || account ? 'Aucun mouvement d\'argent sur cette période.' : (
                    <EmptyState icon={<PiggyBank size={28} />} title="Commencez par votre solde de départ"
                      action={canMove && <button className="btn btn-primary" onClick={() => open('opening')}><PiggyBank size={18} /> Indiquer l'argent disponible</button>}>
                      Indiquez l'argent déjà présent dans la caisse, sur Mobile Money et en banque. Ensuite, chaque encaissement et chaque dépense mettra les soldes à jour tout seul.
                    </EmptyState>
                  )}
                </EmptyRow>
              )}
            </tbody>
          </table>
        </div>
        {data?.truncated && <p className="muted small">Seuls les 300 derniers mouvements sont affichés : choisissez une période plus courte.</p>}
      </div>

      {form && (
        <Modal title={MOVEMENT_TITLES[form.type]} onClose={() => setForm(null)} width={520}>
          <form onSubmit={save}>
            <Alert>{error}</Alert>
            {form.type === 'opening' && <p className="muted small" style={{ marginTop: 0 }}>L'argent qui se trouvait déjà sur ce compte avant de commencer à utiliser OmniCom Facturation.</p>}
            <div className="input-group">
              <span className="label">{form.type === 'transfer' ? 'Depuis' : 'Compte'}</span>
              <div className="choice-chips">
                {ACCOUNTS.map((a) => <button key={a} type="button" className={form.account === a ? 'active' : ''} onClick={() => setForm({ ...form, account: a, toAccount: form.toAccount === a ? ACCOUNTS.find((x) => x !== a)! : form.toAccount })}>{a}</button>)}
              </div>
            </div>
            {form.type === 'transfer' && (
              <div className="input-group">
                <span className="label">Vers</span>
                <div className="choice-chips">
                  {ACCOUNTS.filter((a) => a !== form.account).map((a) => <button key={a} type="button" className={form.toAccount === a ? 'active' : ''} onClick={() => setForm({ ...form, toAccount: a })}>{a}</button>)}
                </div>
              </div>
            )}
            <div className="form-grid">
              <Field label="Montant *"><input className="input-field" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" required autoFocus /></Field>
              <div className="input-group">
                <span className="label">Devise</span>
                <div className="segmented">
                  {(['USD', 'FC'] as const).map((c) => <button key={c} type="button" className={form.currency === c ? 'active' : ''} onClick={() => setForm({ ...form, currency: c })}>{c === 'USD' ? 'Dollar ($)' : 'Franc (FC)'}</button>)}
                </div>
              </div>
            </div>
            <div className="form-grid">
              <Field label={form.type === 'in' ? 'Origine de l\'argent *' : 'Note'}>
                <input className="input-field" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder={form.type === 'in' ? 'Ex : apport du gérant, vente au comptoir' : form.type === 'transfer' ? 'Ex : dépôt à la banque' : 'Optionnel'} required={form.type === 'in'} />
              </Field>
              <Field label="Date"><input type="date" className="input-field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
