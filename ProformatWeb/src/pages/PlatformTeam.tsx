import { useState } from 'react';
import { CheckCircle2, Plus, RefreshCw } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { formatDateTime } from '../lib/format';
import type { User } from '../lib/types';
import { Alert, Field, Modal, PageHeader } from '../components/ui';
import Avatar from '../components/Avatar';
import AccessCard from '../components/AccessCard';
import { generatePassword, type Access } from '../lib/access';

export default function PlatformTeam() {
  const { data, reload } = useFetch(() => api.get<User[]>('/platform/admins'), []);
  const [form, setForm] = useState<{ email: string; displayName: string; password: string } | null>(null);
  const [created, setCreated] = useState<Access | null>(null);
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError('');
    try {
      await api.post('/platform/admins', form);
      setCreated({ email: form.email.trim().toLowerCase(), password: form.password, name: form.displayName });
      setForm(null);
      reload();
    } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Équipe OmniCom" subtitle="Personnes autorisées à créer et gérer les entreprises"
        actions={<button className="btn btn-primary" onClick={() => { setError(''); setForm({ email: '', displayName: '', password: generatePassword() }); }}><Plus size={18} /> Ajouter un membre</button>} />
      <div className="card">
        <div className="people-list">
          {data?.map((u) => (
            <div key={u._id} className="people-row">
              <Avatar name={u.displayName || u.email} photo={u.photoURL} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="strong ellipsis">{u.displayName || u.email}</div>
                <div className="muted small ellipsis">{u.email} · {u.lastLoginAt ? `vu le ${formatDateTime(u.lastLoginAt)}` : 'jamais connecté'}</div>
              </div>
              {u.twoFactorEnabled ? <span className="badge badge-success">2FA activée</span> : <span className="badge badge-warning">2FA à activer</span>}
            </div>
          ))}
        </div>
      </div>
      {form && (
        <Modal title="Nouveau membre OmniCom" onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <Alert>{error}</Alert>
            <Field label="Nom"><input className="input-field" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} autoFocus /></Field>
            <Field label="E-mail *"><input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
            <Field label="Mot de passe provisoire" hint="Généré automatiquement ; à changer après la première connexion.">
              <div className="manual-line" style={{ marginBottom: 0 }}>
                <input type="text" className="input-field mono" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required autoComplete="off" />
                <button type="button" className="btn btn-outline" onClick={() => setForm({ ...form, password: generatePassword() })} title="Générer un autre mot de passe"><RefreshCw size={16} /></button>
              </div>
            </Field>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Ajouter</button>
            </div>
          </form>
        </Modal>
      )}
      {created && (
        <Modal title="Membre ajouté" onClose={() => setCreated(null)} width={560}>
          <div className="success-head">
            <CheckCircle2 size={40} />
            <div><h3>{created.name || created.email} fait partie de l'équipe</h3><p className="muted">Transmettez-lui ces accès :</p></div>
          </div>
          <AccessCard access={created} />
          <div className="modal-actions"><button className="btn btn-primary" onClick={() => setCreated(null)}>Terminé</button></div>
        </Modal>
      )}
    </div>
  );
}
