import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Edit2, Plus, Search, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useFeedback } from '../components/feedback';
import { useFetch } from '../lib/useFetch';
import { downloadCsv, formatByCurrency, formatDate, formatMoney, toInputDate } from '../lib/format';
import { PAYMENT_METHODS, type Currency, type Expense, type Paginated } from '../lib/types';
import { Alert, EmptyRow, Field, Modal, PageHeader, Pagination } from '../components/ui';

interface ExpenseForm { date: string; category: string; description: string; supplier: string; amount: string; currency: Currency; paymentMethod: string; reference: string }

const emptyForm = (): ExpenseForm => ({ date: toInputDate(), category: 'Matières premières', description: '', supplier: '', amount: '', currency: 'USD', paymentMethod: 'Espèces', reference: '' });

export default function Expenses() {
  const { confirm, toast } = useFeedback();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchParams] = useSearchParams();
  // ?new=1 (depuis la trésorerie ou le tableau de bord) ouvre directement le formulaire
  const [editing, setEditing] = useState<{ id: string | null; form: ExpenseForm } | null>(() => (searchParams.get('new') ? { id: null, form: emptyForm() } : null));
  const [error, setError] = useState('');
  const filters = { search, category, from, to };
  const { data, loading, reload } = useFetch(() => api.get<Paginated<Expense> & { totals: Record<Currency, number> }>('/expenses', { ...filters, page }), [search, category, from, to, page]);
  const categories = useFetch(() => api.get<string[]>('/expenses/categories'), []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const body = { ...editing.form, amount: parseFloat(editing.form.amount.replace(',', '.')) };
    setError('');
    try {
      if (editing.id) await api.put(`/expenses/${editing.id}`, body);
      else await api.post('/expenses', body);
      setEditing(null);
      toast('Dépense enregistrée.');
      reload();
    } catch (err) { setError(errorMessage(err)); }
  };

  const remove = async (exp: Expense) => {
    if (!(await confirm({ title: 'Supprimer la dépense ?', message: `« ${exp.description} » sera définitivement supprimée.`, confirmLabel: 'Supprimer', danger: true }))) return;
    try { await api.del(`/expenses/${exp._id}`); reload(); toast('Dépense supprimée.'); } catch (err) { setError(errorMessage(err)); }
  };

  const exportCsv = async () => {
    const all = await api.get<Paginated<Expense>>('/expenses', { ...filters, limit: 200 });
    downloadCsv('depenses.csv', ['Date', 'Catégorie', 'Description', 'Fournisseur', 'Montant', 'Devise', 'Paiement', 'Référence', 'Saisi par'],
      all.items.map((x) => [formatDate(x.date), x.category, x.description, x.supplier, x.amount, x.currency, x.paymentMethod, x.reference, x.createdBy]));
  };

  const set = (key: keyof ExpenseForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEditing((prev) => (prev ? { ...prev, form: { ...prev.form, [key]: e.target.value } } : prev));
  const filter = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { fn(e.target.value); setPage(1); };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Dépenses" subtitle={data ? `Total filtré : ${formatByCurrency(data.totals)}` : undefined} actions={<>
        <button className="btn btn-outline" onClick={exportCsv}><Download size={18} /> Exporter</button>
        <button className="btn btn-primary" onClick={() => setEditing({ id: null, form: emptyForm() })}><Plus size={18} /> Nouvelle dépense</button>
      </>} />
      <Alert>{error}</Alert>
      <div className="toolbar card">
        <div className="search-box"><Search size={16} /><input className="input-field" placeholder="Description, fournisseur…" value={search} onChange={filter(setSearch)} /></div>
        <select className="input-field" value={category} onChange={filter(setCategory)}>
          <option value="">Toutes les catégories</option>
          {categories.data?.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input type="date" className="input-field" value={from} onChange={filter(setFrom)} aria-label="Du" />
        <input type="date" className="input-field" value={to} onChange={filter(setTo)} aria-label="Au" />
      </div>
      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr><th>Date</th><th>Catégorie</th><th>Description</th><th>Fournisseur</th><th className="num">Montant</th><th className="actions">Actions</th></tr></thead>
            <tbody>
              {data?.items.map((x) => (
                <tr key={x._id}>
                  <td className="muted">{formatDate(x.date)}</td>
                  <td><span className="badge badge-neutral">{x.category}</span></td>
                  <td>{x.description}<div className="muted small">{[x.paymentMethod, x.reference].filter(Boolean).join(' · ')}</div></td>
                  <td className="muted">{x.supplier || '—'}</td>
                  <td className="num strong">{formatMoney(x.amount, x.currency)}</td>
                  <td className="actions">
                    <button className="icon-btn" title="Modifier" onClick={() => setEditing({ id: x._id, form: { ...x, date: toInputDate(x.date), amount: String(x.amount) } })}><Edit2 size={16} /></button>
                    <button className="icon-btn text-danger" title="Supprimer" onClick={() => remove(x)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {!loading && data?.items.length === 0 && <EmptyRow colSpan={6}>Aucune dépense enregistrée.</EmptyRow>}
            </tbody>
          </table>
        </div>
        {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
      </div>

      {editing && (
        <Modal title={editing.id ? 'Modifier la dépense' : 'Nouvelle dépense'} onClose={() => setEditing(null)} width={620}>
          <form onSubmit={save}>
            <Field label="Description *"><input className="input-field" value={editing.form.description} onChange={set('description')} required autoFocus /></Field>
            <div className="form-grid">
              <Field label="Date"><input type="date" className="input-field" value={editing.form.date} onChange={set('date')} /></Field>
              <Field label="Catégorie">
                <select className="input-field" value={editing.form.category} onChange={set('category')}>
                  {categories.data?.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Montant *"><input className="input-field" inputMode="decimal" value={editing.form.amount} onChange={set('amount')} required /></Field>
              <Field label="Devise">
                <select className="input-field" value={editing.form.currency} onChange={set('currency')}><option value="USD">USD</option><option value="FC">FC</option></select>
              </Field>
              <Field label="Fournisseur"><input className="input-field" value={editing.form.supplier} onChange={set('supplier')} /></Field>
              <Field label="Mode de paiement">
                <select className="input-field" value={editing.form.paymentMethod} onChange={set('paymentMethod')}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
              </Field>
            </div>
            <Field label="Référence (n° de reçu…)"><input className="input-field" value={editing.form.reference} onChange={set('reference')} /></Field>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
