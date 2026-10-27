import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Building2, CheckCircle2, KeyRound, LogIn, Plus, Power, RefreshCw, Search, Settings2, UserPlus } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useFeedback } from '../components/feedback';
import { useFetch } from '../lib/useFetch';
import { formatDate, formatDateTime } from '../lib/format';
import type { Company, User } from '../lib/types';
import { Alert, EmptyState, Field, Modal, PageHeader, StatCard } from '../components/ui';
import Avatar from '../components/Avatar';
import AccessCard from '../components/AccessCard';
import CompanyForm, { ImageInput } from '../components/CompanyForm';
import { EMPTY_COMPANY, toDraft, type CompanyDraft } from '../lib/company';
import { dominantColor, generatePassword, type Access } from '../lib/access';
import { logoBackground } from '../lib/brand';

interface AdminDraft { email: string; displayName: string; password: string }
const newAdmin = (): AdminDraft => ({ email: '', displayName: '', password: generatePassword() });

function AdminFields({ admin, onChange }: { admin: AdminDraft; onChange: (a: AdminDraft) => void }) {
  return (
    <>
      <div className="form-grid">
        <Field label="Nom"><input className="input-field" value={admin.displayName} onChange={(e) => onChange({ ...admin, displayName: e.target.value })} placeholder="Ex : Jean Kabila" /></Field>
        <Field label="E-mail *"><input type="email" className="input-field" value={admin.email} onChange={(e) => onChange({ ...admin, email: e.target.value })} placeholder="admin@entreprise.cd" required /></Field>
      </div>
      <Field label="Mot de passe provisoire" hint="Généré automatiquement ; la personne le changera après sa première connexion.">
        <div className="manual-line" style={{ marginBottom: 0 }}>
          <input type="text" className="input-field mono" value={admin.password} onChange={(e) => onChange({ ...admin, password: e.target.value })} minLength={8} required autoComplete="off" />
          <button type="button" className="btn btn-outline" onClick={() => onChange({ ...admin, password: generatePassword() })} title="Générer un autre mot de passe"><RefreshCw size={16} /></button>
        </div>
      </Field>
    </>
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

function CompanyLogo({ company, size = 48 }: { company: Company; size?: number }) {
  return company.logo
    ? <img className="company-logo" src={company.logo} alt="" style={{ width: size, height: size, ...logoBackground(company) }} />
    : <span className="company-logo placeholder" style={{ width: size, height: size }}>{company.name.charAt(0).toUpperCase()}</span>;
}

export default function PlatformCompanies() {
  const openConsole = useOpenConsole();
  const { data, loading, reload } = useFetch(() => api.get<Company[]>('/platform/companies'), []);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = (data || []).filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const active = (data || []).filter((c) => c.isActive).length;
  const createButton = <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={18} /> Nouvelle entreprise</button>;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Entreprises" subtitle="Créez un compte entreprise en une minute, puis ouvrez sa console pour l'aider." actions={createButton} />

      <div className="stat-grid">
        <StatCard label="Entreprises" value={data?.length ?? '—'} hint={`${active} active(s)`} />
        <StatCard label="Utilisateurs" value={(data || []).reduce((s, c) => s + (c.userCount || 0), 0)} />
        <StatCard label="Documents émis" value={(data || []).reduce((s, c) => s + (c.invoiceCount || 0), 0)} />
      </div>

      {(data?.length || 0) > 3 && (
        <div className="toolbar card">
          <div className="search-box"><Search size={16} /><input className="input-field" placeholder="Rechercher une entreprise…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
      )}

      {!loading && list.length === 0 ? (
        <div className="card">
          {search ? <div className="empty-cell">Aucune entreprise ne correspond à cette recherche.</div> : (
            <EmptyState icon={<Building2 size={28} />} title="Aucune entreprise" action={createButton}>
              Créez le compte d'une entreprise avec son logo et son administrateur : il pourra ensuite inviter son équipe.
            </EmptyState>
          )}
        </div>
      ) : (
        <div className="company-grid">
          {list.map((c) => (
            <div key={c._id} className={`card company-card ${c.isActive ? '' : 'inactive'}`}>
              <div className="company-card-head">
                <CompanyLogo company={c} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="strong ellipsis">{c.name}</div>
                  <div className="muted small ellipsis">{[c.city, c.phone].filter(Boolean).join(' · ') || `Créée le ${formatDate(c.createdAt)}`}</div>
                </div>
                {c.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Suspendue</span>}
              </div>
              <div className="company-card-stats">
                <div><strong>{c.userCount ?? 0}</strong><span>utilisateur{(c.userCount ?? 0) > 1 ? 's' : ''}</span></div>
                <div><strong>{c.invoiceCount ?? 0}</strong><span>document{(c.invoiceCount ?? 0) > 1 ? 's' : ''}</span></div>
                <div><strong>{c.lastInvoiceAt ? formatDate(c.lastInvoiceAt) : '—'}</strong><span>dernière facture</span></div>
              </div>
              <div className="company-card-actions">
                <button className="btn btn-primary btn-sm" onClick={() => openConsole(c._id)} title={`Ouvrir la console de ${c.name}`}><LogIn size={15} /> Ouvrir</button>
                <button className="btn btn-outline btn-sm" onClick={() => setDetailId(c._id)}><Settings2 size={15} /> Gérer</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <NewCompany onClose={() => setCreating(false)} onCreated={reload} onOpen={openConsole} />}
      {detailId && <CompanyDetail id={detailId} onClose={() => setDetailId(null)} onChanged={reload} />}
    </div>
  );
}

// Création en un seul écran : l'essentiel seulement, le reste se complète dans la console de l'entreprise
function NewCompany({ onClose, onCreated, onOpen }: { onClose: () => void; onCreated: () => void; onOpen: (id: string) => void }) {
  const [company, setCompany] = useState<CompanyDraft>(EMPTY_COMPANY);
  const [admin, setAdmin] = useState<AdminDraft>(newAdmin);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: string; access: Access } | null>(null);

  const setLogo = async (logo: string) => {
    const color = logo ? await dominantColor(logo) : null;
    setCompany((c) => ({ ...c, logo, primaryColor: color || EMPTY_COMPANY.primaryColor }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post<{ company: Company }>('/platform/companies', { ...company, admin });
      setCreated({ id: res.company._id, access: { email: admin.email.trim().toLowerCase(), password: admin.password, name: admin.displayName, companyName: company.name } });
      onCreated();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  if (created) {
    return (
      <Modal title="Entreprise créée" onClose={onClose} width={560}>
        <div className="success-head">
          <CheckCircle2 size={40} />
          <div>
            <h3>{company.name} est prête</h3>
            <p className="muted">Transmettez ces accès à {created.access.name || 'son administrateur'} :</p>
          </div>
        </div>
        <AccessCard access={created.access} />
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Terminé</button>
          <button className="btn btn-primary" onClick={() => onOpen(created.id)}><LogIn size={16} /> Ouvrir sa console</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Nouvelle entreprise" onClose={onClose} width={620}>
      <form onSubmit={submit}>
        <Alert>{error}</Alert>
        <div className="step-title"><span>1</span>L'entreprise</div>
        <Field label="Nom de l'entreprise *"><input className="input-field" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} placeholder="Ex : Mélanine Print" required autoFocus /></Field>
        <ImageInput label="Logo (imprimé sur ses factures)" value={company.logo} onChange={setLogo} previewStyle={logoBackground(company)} />
        {company.logo && (
          <p className="muted small brand-hint">
            <span className="swatch" style={{ background: company.primaryColor }} /> Couleur des factures choisie d'après le logo (modifiable ensuite).
          </p>
        )}
        <div className="form-grid">
          <Field label="Téléphone"><input className="input-field" value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} placeholder="+243 …" /></Field>
          <Field label="Ville"><input className="input-field" value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} /></Field>
        </div>

        <div className="step-title"><span>2</span>Son administrateur</div>
        <AdminFields admin={admin} onChange={setAdmin} />
        <p className="muted small">Adresse, numéro d'impôt, banque, couleurs et modèle de facture se complètent ensuite dans la console de l'entreprise (par vous ou par son administrateur).</p>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary" disabled={busy}><Building2 size={18} /> {busy ? 'Création…' : 'Créer l\'entreprise'}</button>
        </div>
      </form>
    </Modal>
  );
}

function CompanyDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { confirm } = useFeedback();
  const openConsole = useOpenConsole();
  const { data, reload } = useFetch(() => api.get<{ company: Company; users: User[] }>(`/platform/companies/${id}`), [id]);
  const [form, setForm] = useState<CompanyDraft | null>(null);
  const [admin, setAdmin] = useState<AdminDraft | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const draft = form || (data ? toDraft(data.company) : null);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setError('');
    setMessage('');
    try { await fn(); setMessage(success); reload(); onChanged(); return true; } catch (err) { setError(errorMessage(err)); return false; }
  };

  if (!data || !draft) return <Modal title="Entreprise" onClose={onClose}><div className="muted">Chargement…</div></Modal>;
  const { company, users } = data;

  const resetPassword = async (u: User) => {
    if (!(await confirm({ title: `Nouveau mot de passe pour ${u.displayName || u.email} ?`, message: 'Un mot de passe provisoire est généré ; l\'ancien ne fonctionnera plus.', confirmLabel: 'Générer' }))) return;
    const password = generatePassword();
    if (await run(() => api.post(`/platform/companies/${id}/users/${u._id}/reset-password`, { password }), `Mot de passe de ${u.email} réinitialisé.`)) {
      setAccess({ email: u.email, password, name: u.displayName, companyName: company.name });
    }
  };

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin) return;
    if (await run(() => api.post(`/platform/companies/${id}/admins`, admin), 'Administrateur ajouté.')) {
      setAccess({ email: admin.email.trim().toLowerCase(), password: admin.password, name: admin.displayName, companyName: company.name });
      setAdmin(null);
    }
  };

  return (
    <Modal title={company.name} onClose={onClose} width={860}>
      <div className="company-detail-head">
        <CompanyLogo company={company} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row-gap">{company.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Suspendue</span>}</div>
          <div className="muted small">Créée le {formatDate(company.createdAt)} · {users.length} utilisateur{users.length > 1 ? 's' : ''}</div>
        </div>
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
      <Alert>{error}</Alert>
      <Alert tone="success">{message}</Alert>
      {access && (
        <div style={{ marginBottom: 16 }}>
          <p className="muted small" style={{ margin: '0 0 8px' }}>Accès à transmettre à {access.name || access.email} :</p>
          <AccessCard access={access} />
        </div>
      )}

      <h3 className="section-title">Utilisateurs</h3>
      <div className="people-list">
        {users.map((u) => (
          <div key={u._id} className="people-row">
            <Avatar name={u.displayName || u.email} photo={u.photoURL} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="strong ellipsis">{u.displayName || 'Sans nom'} <span className="muted small">· {u.roleName}{u.isBlocked ? ' · bloqué' : ''}</span></div>
              <div className="muted small ellipsis">{u.email} · {u.lastLoginAt ? `vu le ${formatDateTime(u.lastLoginAt)}` : 'jamais connecté'}</div>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => resetPassword(u)}><KeyRound size={15} /> Nouveau mot de passe</button>
          </div>
        ))}
      </div>
      {admin ? (
        <form onSubmit={addAdmin} className="inline-panel">
          <AdminFields admin={admin} onChange={setAdmin} />
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setAdmin(null)}>Annuler</button>
            <button type="submit" className="btn btn-primary">Ajouter l'administrateur</button>
          </div>
        </form>
      ) : (
        <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => { setAccess(null); setAdmin(newAdmin()); }}><UserPlus size={16} /> Ajouter un administrateur</button>
      )}

      <details className="more-options" style={{ marginTop: 20 }}>
        <summary>Profil, coordonnées et couleurs de l'entreprise</summary>
        <form onSubmit={(e) => { e.preventDefault(); run(() => api.put(`/platform/companies/${id}`, draft), 'Entreprise mise à jour.'); }}>
          <CompanyForm form={draft} onChange={setForm} />
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">Enregistrer</button>
          </div>
        </form>
      </details>
    </Modal>
  );
}
