import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Download, Edit2, Plus, Search } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { useAuth } from '../auth/AuthContext';
import { downloadCsv, formatByCurrency, formatDate, formatMoney } from '../lib/format';
import type { Client, Invoice, Payment, Balance, Currency } from '../lib/types';
import { Alert, EmptyRow, Field, Modal, PageHeader, StatusBadge } from '../components/ui';

const EMPTY = { name: '', activity: '', contactPerson: '', phone: '', email: '', address: '', taxNumber: '', notes: '' };
type ClientForm = typeof EMPTY;

const dueOf = (balances?: Partial<Record<Currency, Balance>>) =>
  Object.fromEntries(Object.entries(balances || {}).map(([c, b]) => [c, b?.due || 0]));

export default function Clients() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ id: string | null; form: ClientForm } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { data, loading, reload } = useFetch(() => api.get<Client[]>('/clients', { search }), [search]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError('');
    try {
      if (editing.id) await api.put(`/clients/${editing.id}`, editing.form);
      else await api.post('/clients', editing.form);
      setEditing(null);
      reload();
    } catch (err) { setError(errorMessage(err)); }
  };

  const remove = async (c: Client) => {
    if (!window.confirm(`Supprimer ou archiver le client ${c.name} ?`)) return;
    try {
      const res = await api.del<{ archived?: boolean }>(`/clients/${c._id}`);
      if (res.archived) window.alert('Ce client a des factures : il a été archivé plutôt que supprimé.');
      reload();
    } catch (err) { setError(errorMessage(err)); }
  };

  const exportCsv = () => downloadCsv('clients.csv', ['Nom', 'Activité', 'Contact', 'Téléphone', 'E-mail', 'Adresse', 'N° impôt', 'Factures', 'Solde USD', 'Solde FC'],
    (data || []).map((c) => [c.name, c.activity, c.contactPerson, c.phone, c.email, c.address, c.taxNumber, c.invoiceCount, c.balances?.USD?.due || 0, c.balances?.FC?.due || 0]));

  const set = (key: keyof ClientForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEditing((prev) => (prev ? { ...prev, form: { ...prev.form, [key]: e.target.value } } : prev));

  return (
    <div className="animate-fade-in">
      <PageHeader title="Clients" subtitle={data ? `${data.length} client(s)` : undefined} actions={<>
        <button className="btn btn-outline" onClick={exportCsv}><Download size={18} /> Exporter</button>
        {can('clients.manage') && <button className="btn btn-primary" onClick={() => setEditing({ id: null, form: EMPTY })}><Plus size={18} /> Nouveau client</button>}
      </>} />
      <Alert>{error}</Alert>
      <div className="toolbar card">
        <div className="search-box"><Search size={16} /><input className="input-field" placeholder="Nom, activité, téléphone…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr><th>Client</th><th>Contact</th><th className="num">Factures</th><th className="num">Solde dû</th><th className="actions">Actions</th></tr></thead>
            <tbody>
              {data?.map((c) => (
                <tr key={c._id} className="clickable" onClick={() => setDetailId(c._id)}>
                  <td><div className="strong">{c.name}</div><div className="muted small">{c.activity}</div></td>
                  <td className="muted small">{[c.contactPerson, c.phone, c.email].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="num">{c.invoiceCount || 0}</td>
                  <td className="num strong">{formatByCurrency(dueOf(c.balances))}</td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    {can('clients.manage') && <button className="icon-btn" title="Modifier" onClick={() => setEditing({ id: c._id, form: { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, (c as unknown as Record<string, string>)[k] || ''])) } as ClientForm })}><Edit2 size={16} /></button>}
                    {can('clients.delete') && <button className="icon-btn text-danger" title="Supprimer / archiver" onClick={() => remove(c)}><Archive size={16} /></button>}
                  </td>
                </tr>
              ))}
              {!loading && data?.length === 0 && <EmptyRow colSpan={5}>Aucun client. Les clients sont aussi créés automatiquement lors de la facturation.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal title={editing.id ? 'Modifier le client' : 'Nouveau client'} onClose={() => setEditing(null)} width={640}>
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Nom / raison sociale *"><input className="input-field" value={editing.form.name} onChange={set('name')} required autoFocus /></Field>
              <Field label="Activité / secteur"><input className="input-field" value={editing.form.activity} onChange={set('activity')} /></Field>
              <Field label="Personne de contact"><input className="input-field" value={editing.form.contactPerson} onChange={set('contactPerson')} /></Field>
              <Field label="Téléphone"><input className="input-field" value={editing.form.phone} onChange={set('phone')} /></Field>
              <Field label="E-mail"><input type="email" className="input-field" value={editing.form.email} onChange={set('email')} /></Field>
              <Field label="N° impôt / RCCM"><input className="input-field" value={editing.form.taxNumber} onChange={set('taxNumber')} /></Field>
            </div>
            <Field label="Adresse"><input className="input-field" value={editing.form.address} onChange={set('address')} /></Field>
            <Field label="Notes"><textarea className="input-field" rows={2} value={editing.form.notes} onChange={set('notes')} /></Field>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Enregistrer</button>
            </div>
          </form>
        </Modal>
      )}

      {detailId && <ClientDetail id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function ClientDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useFetch(() => api.get<{ client: Client; invoices: Invoice[]; payments: Payment[]; balances: Client['balances'] }>(`/clients/${id}`), [id]);
  return (
    <Modal title={data?.client.name || 'Client'} onClose={onClose} width={760}>
      {!data ? <div className="muted">Chargement…</div> : (
        <>
          <div className="info-list">
            {data.client.activity && <div><span>Activité</span><strong>{data.client.activity}</strong></div>}
            {data.client.phone && <div><span>Téléphone</span><strong>{data.client.phone}</strong></div>}
            {data.client.email && <div><span>E-mail</span><strong>{data.client.email}</strong></div>}
            {data.client.address && <div><span>Adresse</span><strong>{data.client.address}</strong></div>}
            {Object.entries(data.balances || {}).map(([c, b]) => (
              <div key={c}><span>Facturé / payé ({c})</span><strong>{formatMoney(b?.invoiced, c)} / {formatMoney(b?.paid, c)} — reste {formatMoney(b?.due, c)}</strong></div>
            ))}
          </div>
          <h3 className="section-title">Historique des documents</h3>
          <div className="table-container">
            <table>
              <thead><tr><th>Numéro</th><th>Date</th><th className="num">Total</th><th className="num">Reste</th><th>Statut</th></tr></thead>
              <tbody>
                {data.invoices.map((inv) => (
                  <tr key={inv._id}>
                    <td><Link to={`/invoice/${inv._id}`}>{inv.number}</Link> <span className="muted small">{inv.type}</span></td>
                    <td className="muted">{formatDate(inv.issueDate)}</td>
                    <td className="num">{formatMoney(inv.totalAmount, inv.currency)}</td>
                    <td className="num">{inv.type === 'Facture' && inv.status !== 'Annulée' ? formatMoney(inv.balance, inv.currency) : '—'}</td>
                    <td><StatusBadge status={inv.status} /></td>
                  </tr>
                ))}
                {data.invoices.length === 0 && <EmptyRow colSpan={5}>Aucun document.</EmptyRow>}
              </tbody>
            </table>
          </div>
          <div className="modal-actions">
            <Link className="btn btn-primary" to="/invoice">Nouvelle facture</Link>
          </div>
        </>
      )}
    </Modal>
  );
}
