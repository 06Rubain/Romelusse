import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { formatDateTime } from '../lib/format';
import type { User } from '../lib/types';
import { Alert, Field, Modal, PageHeader } from '../components/ui';
import Avatar from '../components/Avatar';

export default function PlatformTeam() {
  const { data, reload } = useFetch(() => api.get<User[]>('/platform/admins'), []);
  const [form, setForm] = useState<{ email: string; displayName: string; password: string } | null>(null);
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError('');
    try { await api.post('/platform/admins', form); setForm(null); reload(); } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Équipe OmniCom" subtitle="Super-administrateurs autorisés à gérer les entreprises"
        actions={<button className="btn btn-primary" onClick={() => setForm({ email: '', displayName: '', password: '' })}><Plus size={18} /> Ajouter</button>} />
      <div className="card">
        <table>
          <thead><tr><th>Nom</th><th>E-mail</th><th>2FA</th><th>Dernière connexion</th></tr></thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u._id}>
                <td><div className="person"><Avatar name={u.displayName || u.email} photo={u.photoURL} /><span className="strong">{u.displayName || '—'}</span></div></td>
                <td className="muted">{u.email}</td>
                <td>{u.twoFactorEnabled ? <span className="text-success">Activée</span> : <span className="text-warning">À activer</span>}</td>
                <td className="muted small">{formatDateTime(u.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && (
        <Modal title="Nouveau super-admin OmniCom" onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <Alert>{error}</Alert>
            <Field label="Nom"><input className="input-field" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Field>
            <Field label="E-mail *"><input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
            <Field label="Mot de passe provisoire *"><input type="text" className="input-field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required /></Field>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Créer</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
