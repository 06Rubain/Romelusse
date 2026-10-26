import { useState } from 'react';
import { KeyRound, Plus, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { useAuth } from '../auth/AuthContext';
import { formatDateTime } from '../lib/format';
import { ROLE_LABELS, type Role, type User } from '../lib/types';
import { Alert, Field, Modal, PageHeader } from '../components/ui';

export default function UsersList() {
  const { user: me } = useAuth();
  const { data, reload } = useFetch(() => api.get<User[]>('/users'), []);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: '', displayName: '', role: 'user' as Role, password: '' });
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); reload(); } catch (err) { setError(errorMessage(err)); }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.post('/users', form);
      setCreating(false);
      setForm({ email: '', displayName: '', role: 'user', password: '' });
    });
  };

  const resetPassword = (u: User) => {
    const password = window.prompt(`Nouveau mot de passe pour ${u.email} (8 caractères minimum) :`);
    if (password) run(() => api.post(`/users/${u._id}/reset-password`, { password }));
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Équipe" subtitle="Comptes, rôles et accès"
        actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={18} /> Nouveau compte</button>} />
      <Alert>{error}</Alert>
      <div className="card muted small" style={{ marginBottom: 16 }}>
        <strong>Administrateur</strong> : accès complet, équipe et paramètres · <strong>Gestionnaire</strong> : catalogue, stock, dépenses, rapports, annulations ·
        <strong> Employé</strong> : facturation, encaissements et clients.
      </div>
      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr><th>Utilisateur</th><th>Rôle</th><th>2FA</th><th>Dernière connexion</th><th>Statut</th><th className="actions">Actions</th></tr></thead>
            <tbody>
              {data?.map((u) => {
                const self = u._id === me?._id;
                return (
                  <tr key={u._id} style={{ opacity: u.isBlocked ? 0.6 : 1 }}>
                    <td><div className="strong">{u.displayName || 'Sans nom'}{self && <span className="muted small"> (vous)</span>}</div><div className="muted small">{u.email}</div></td>
                    <td>
                      <select className="input-field input-sm" value={u.role} disabled={self} onChange={(e) => run(() => api.patch(`/users/${u._id}`, { role: e.target.value }))}>
                        {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </td>
                    <td>{u.twoFactorEnabled ? <span className="text-success">Activée</span> : <span className="muted">—</span>}</td>
                    <td className="muted small">{formatDateTime(u.lastLoginAt)}</td>
                    <td>{u.isBlocked
                      ? <span className="text-danger row-gap"><ShieldAlert size={16} /> Bloqué</span>
                      : <span className="text-success row-gap"><ShieldCheck size={16} /> Actif</span>}</td>
                    <td className="actions">
                      <button className="icon-btn" title="Réinitialiser le mot de passe" onClick={() => resetPassword(u)}><KeyRound size={16} /></button>
                      {u.twoFactorEnabled && !self && (
                        <button className="icon-btn" title="Réinitialiser la 2FA" onClick={() => window.confirm(`Désactiver la 2FA de ${u.email} ?`) && run(() => api.post(`/users/${u._id}/reset-2fa`))}><ShieldOff size={16} /></button>
                      )}
                      {!self && (
                        <button className={`btn btn-sm ${u.isBlocked ? 'btn-outline' : 'btn-danger-soft'}`}
                          onClick={() => window.confirm(`${u.isBlocked ? 'Débloquer' : 'Bloquer'} ${u.email} ?`) && run(() => api.patch(`/users/${u._id}`, { isBlocked: !u.isBlocked }))}>
                          {u.isBlocked ? 'Débloquer' : 'Bloquer'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <Modal title="Nouveau compte" onClose={() => setCreating(false)}>
          <form onSubmit={create}>
            <Field label="Nom complet"><input className="input-field" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Field>
            <Field label="E-mail *"><input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
            <div className="form-grid">
              <Field label="Rôle">
                <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </Field>
              <Field label="Mot de passe provisoire *" hint="8 caractères minimum">
                <input type="text" className="input-field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required autoComplete="off" />
              </Field>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setCreating(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Créer le compte</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
