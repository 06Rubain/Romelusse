import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Building2, KeyRound, LogIn, Plus, Power, Search, UserPlus } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useFeedback } from '../components/feedback';
import { useFetch } from '../lib/useFetch';
import { formatDate, formatDateTime } from '../lib/format';
import type { Company, User } from '../lib/types';
import { Alert, EmptyRow, EmptyState, Field, Modal, PageHeader, StatCard } from '../components/ui';
import CompanyForm from '../components/CompanyForm';
import { EMPTY_COMPANY, toDraft, type CompanyDraft } from '../lib/company';

interface AdminDraft { email: string; displayName: string; password: string }
const EMPTY_ADMIN: AdminDraft = { email: '', displayName: '', password: '' };

function AdminFields({ admin, onChange }: { admin: AdminDraft; onChange: (a: AdminDraft) => void }) {
  return (
    <div className="form-grid">
      <Field label="Nom de l'administrateur"><input className="input-field" value={admin.displayName} onChange={(e) => onChange({ ...admin, displayName: e.target.value })} /></Field>
      <Field label="E-mail de l'administrateur *"><input type="email" className="input-field" value={admin.email} onChange={(e) => onChange({ ...admin, email: e.target.value })} required /></Field>
      <Field label="Mot de passe provisoire *" hint="8 caractères minimum, à changer à la première connexion">
        <input type="text" className="input-field" value={admin.password} onChange={(e) => onChange({ ...admin, password: e.target.value })} minLength={8} required autoComplete="off" />
      </Field>
    </div>
  );
}

// Ouvre la console d'une entreprise en tant que super-admin OmniCom
function useOpenConsole() {
  const { enterCompany } = useAuth();
  const navigate = useNavigate();
  return async (companyId: string) => {
    await enterCompany(companyId);
    navigate('/dashboard');
  };
}

export default function PlatformCompanies() {
  const openConsole = useOpenConsole();
  const { data, loading, reload } = useFetch(() => api.get<Company[]>('/platform/companies'), []);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState<{ company: CompanyDraft; admin: AdminDraft } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const list = (data || []).filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const active = (data || []).filter((c) => c.isActive).length;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creating) return;
    setError('');
    setBusy(true);
    try {
      await api.post('/platform/companies', { ...creating.company, admin: creating.admin });
      setCreating(null);
      reload();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Entreprises" subtitle="Comptes entreprise de la plateforme OmniCom Facturation"
        actions={<button className="btn btn-primary" onClick={() => { setError(''); setCreating({ company: EMPTY_COMPANY, admin: EMPTY_ADMIN }); }}><Plus size={18} /> Nouvelle entreprise</button>} />

      <div className="stat-grid">
        <StatCard label="Entreprises" value={data?.length ?? '—'} hint={`${active} active(s)`} />
        <StatCard label="Utilisateurs" value={(data || []).reduce((s, c) => s + (c.userCount || 0), 0)} />
        <StatCard label="Documents émis" value={(data || []).reduce((s, c) => s + (c.invoiceCount || 0), 0)} />
      </div>

      <div className="toolbar card">
        <div className="search-box"><Search size={16} /><input className="input-field" placeholder="Rechercher une entreprise…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr><th>Entreprise</th><th className="num">Utilisateurs</th><th className="num">Documents</th><th>Dernière facture</th><th>Créée le</th><th>Statut</th><th className="actions">Console</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c._id} className="clickable" onClick={() => setDetailId(c._id)}>
                  <td>
                    <div className="company-cell">
                      {c.logo ? <img src={c.logo} alt="" /> : <span className="placeholder">{c.name.charAt(0).toUpperCase()}</span>}
                      <div><div className="strong">{c.name}</div><div className="muted small">{[c.city, c.phone].filter(Boolean).join(' · ')}</div></div>
                    </div>
                  </td>
                  <td className="num">{c.userCount}</td>
                  <td className="num">{c.invoiceCount}</td>
                  <td className="muted">{formatDate(c.lastInvoiceAt)}</td>
                  <td className="muted">{formatDate(c.createdAt)}</td>
                  <td>{c.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Suspendue</span>}</td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-sm btn-outline" onClick={() => openConsole(c._id)} title={`Ouvrir la console de ${c.name}`}><LogIn size={15} /> Ouvrir</button>
                  </td>
                </tr>
              ))}
              {!loading && list.length === 0 && (
                <EmptyRow colSpan={7}>
                  {search ? 'Aucune entreprise ne correspond à cette recherche.' : (
                    <EmptyState icon={<Building2 size={28} />} title="Aucune entreprise"
                      action={<button className="btn btn-primary" onClick={() => { setError(''); setCreating({ company: EMPTY_COMPANY, admin: EMPTY_ADMIN }); }}><Plus size={18} /> Créer la première entreprise</button>}>
                      Créez le compte d'une entreprise avec son logo et son administrateur : il pourra ensuite inviter son équipe.
                    </EmptyState>
                  )}
                </EmptyRow>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <Modal title="Nouvelle entreprise" onClose={() => setCreating(null)} width={1000}>
          <form onSubmit={create}>
            <Alert>{error}</Alert>
            <CompanyForm form={creating.company} onChange={(company) => setCreating({ ...creating, company })} />
            <h3 style={{ marginTop: 16 }}><UserPlus size={18} /> Administrateur de l'entreprise</h3>
            <p className="muted small">Il pourra ensuite créer ses propres rôles et utilisateurs.</p>
            <AdminFields admin={creating.admin} onChange={(admin) => setCreating({ ...creating, admin })} />
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setCreating(null)}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={busy}><Building2 size={18} /> {busy ? 'Création…' : 'Créer l\'entreprise'}</button>
            </div>
          </form>
        </Modal>
      )}

      {detailId && <CompanyDetail id={detailId} onClose={() => setDetailId(null)} onChanged={reload} />}
    </div>
  );
}

function CompanyDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { confirm, prompt } = useFeedback();
  const openConsole = useOpenConsole();
  const { data, reload } = useFetch(() => api.get<{ company: Company; users: User[] }>(`/platform/companies/${id}`), [id]);
  const [form, setForm] = useState<CompanyDraft | null>(null);
  const [admin, setAdmin] = useState<AdminDraft | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const draft = form || (data ? toDraft(data.company) : null);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setError('');
    setMessage('');
    try { await fn(); setMessage(success); reload(); onChanged(); } catch (err) { setError(errorMessage(err)); }
  };

  if (!data || !draft) return <Modal title="Entreprise" onClose={onClose}><div className="muted">Chargement…</div></Modal>;
  const { company, users } = data;

  return (
    <Modal title={company.name} onClose={onClose} width={1000}>
      <Alert>{error}</Alert>
      <Alert tone="success">{message}</Alert>
      <div className="card-header">
        <span>{company.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Suspendue</span>}</span>
        <div className="row-gap">
        <button className="btn btn-sm btn-primary" onClick={() => openConsole(id)}><LogIn size={16} /> Ouvrir la console</button>
        <button className={`btn btn-sm ${company.isActive ? 'btn-danger-soft' : 'btn-outline'}`}
          onClick={async () => (await confirm(company.isActive
            ? { title: `Suspendre ${company.name} ?`, message: 'Ses utilisateurs ne pourront plus se connecter jusqu\'à la réactivation.', confirmLabel: 'Suspendre', danger: true }
            : { title: `Réactiver ${company.name} ?`, message: 'Ses utilisateurs pourront de nouveau se connecter.', confirmLabel: 'Réactiver' }))
            && run(() => api.put(`/platform/companies/${id}`, { isActive: !company.isActive }), company.isActive ? 'Entreprise suspendue.' : 'Entreprise réactivée.')}>
          <Power size={16} /> {company.isActive ? 'Suspendre' : 'Réactiver'}
        </button>
        </div>
      </div>

      <h3 className="section-title">Utilisateurs ({users.length})</h3>
      <div className="table-container">
        <table>
          <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Dernière connexion</th><th className="actions">Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td><div className="strong">{u.displayName || 'Sans nom'}</div><div className="muted small">{u.email}{u.isBlocked ? ' · bloqué' : ''}</div></td>
                <td>{u.roleName}</td>
                <td className="muted small">{formatDateTime(u.lastLoginAt)}</td>
                <td className="actions">
                  <button className="icon-btn" title="Réinitialiser le mot de passe" onClick={async () => {
                    const password = await prompt({ title: 'Nouveau mot de passe', message: u.email, label: 'Mot de passe', type: 'password', minLength: 8, confirmLabel: 'Réinitialiser' });
                    if (password) run(() => api.post(`/platform/companies/${id}/users/${u._id}/reset-password`, { password }), `Mot de passe de ${u.email} réinitialisé.`);
                  }}><KeyRound size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {admin ? (
        <form onSubmit={(e) => { e.preventDefault(); run(async () => { await api.post(`/platform/companies/${id}/admins`, admin); setAdmin(null); }, 'Administrateur ajouté.'); }}>
          <AdminFields admin={admin} onChange={setAdmin} />
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setAdmin(null)}>Annuler</button>
            <button type="submit" className="btn btn-primary">Ajouter l'administrateur</button>
          </div>
        </form>
      ) : (
        <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => setAdmin(EMPTY_ADMIN)}><UserPlus size={16} /> Ajouter un administrateur</button>
      )}

      <h3 className="section-title">Profil et personnalisation</h3>
      <form onSubmit={(e) => { e.preventDefault(); run(() => api.put(`/platform/companies/${id}`, draft), 'Entreprise mise à jour.'); }}>
        <CompanyForm form={draft} onChange={setForm} />
        <div className="modal-actions">
          <button type="submit" className="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}
