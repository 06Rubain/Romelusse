import { useState } from 'react';
import { KeyRound, Plus, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { useFeedback } from '../components/feedback';
import { useFetch } from '../lib/useFetch';
import { useAuth } from '../auth/AuthContext';
import { formatDateTime } from '../lib/format';
import type { Role, User } from '../lib/types';
import { Alert, Field, Modal, PageHeader } from '../components/ui';

export default function UsersList() {
  const { confirm, prompt } = useFeedback();
  const { user: me, can } = useAuth();
  const { data, reload } = useFetch(() => api.get<User[]>('/users'), []);
  const roles = useFetch(() => api.get<Role[]>('/roles'), []);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: '', displayName: '', roleId: '', password: '' });
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); reload(); } catch (err) { setError(errorMessage(err)); }
  };

  const openCreate = () => {
    const employee = roles.data?.find((r) => !r.isSystem) || roles.data?.[0];
    setForm({ email: '', displayName: '', roleId: employee?._id || '', password: '' });
    setCreating(true);
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.post('/users', form);
      setCreating(false);
    });
  };

  const resetPassword = async (u: User) => {
    const password = await prompt({ title: 'Nouveau mot de passe', message: u.email, label: 'Mot de passe', type: 'password', minLength: 8, confirmLabel: 'Réinitialiser' });
    if (password) run(() => api.post(`/users/${u._id}/reset-password`, { password }));
  };

  const roleOptions = roles.data?.map((r) => <option key={r._id} value={r._id}>{r.name}</option>);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Utilisateurs" subtitle="Comptes de votre entreprise et leurs rôles"
        actions={<>
          {can('roles.manage') && <Link className="btn btn-outline" to="/roles"><ShieldCheck size={18} /> Gérer les rôles</Link>}
          <button className="btn btn-primary" onClick={openCreate}><Plus size={18} /> Nouvel utilisateur</button>
        </>} />
      <Alert>{error}</Alert>
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
                      <select className="input-field input-sm" value={u.roleId || ''} disabled={self} onChange={(e) => run(() => api.patch(`/users/${u._id}`, { roleId: e.target.value }))}>
                        {roleOptions}
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
                        <button className="icon-btn" title="Réinitialiser la 2FA" onClick={async () => (await confirm({ title: 'Désactiver la double authentification ?', message: u.email, confirmLabel: 'Désactiver', danger: true })) && run(() => api.post(`/users/${u._id}/reset-2fa`))}><ShieldOff size={16} /></button>
                      )}
                      {!self && (
                        <button className={`btn btn-sm ${u.isBlocked ? 'btn-outline' : 'btn-danger-soft'}`}
                          onClick={async () => (await confirm(u.isBlocked
                            ? { title: `Débloquer ${u.email} ?`, confirmLabel: 'Débloquer' }
                            : { title: `Bloquer ${u.email} ?`, message: 'Cette personne ne pourra plus se connecter.', confirmLabel: 'Bloquer', danger: true })) && run(() => api.patch(`/users/${u._id}`, { isBlocked: !u.isBlocked }))}>
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
        <Modal title="Nouvel utilisateur" onClose={() => setCreating(false)}>
          <form onSubmit={create}>
            <Field label="Nom complet"><input className="input-field" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Field>
            <Field label="E-mail *"><input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
            <div className="form-grid">
              <Field label="Rôle">
                <select className="input-field" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} required>{roleOptions}</select>
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
