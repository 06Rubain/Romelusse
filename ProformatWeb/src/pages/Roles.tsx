import { useState } from 'react';
import { Edit2, Lock, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useFeedback } from '../components/feedback';
import { useFetch } from '../lib/useFetch';
import { useAuth } from '../auth/AuthContext';
import { PERMISSION_GROUPS, type Permission, type Role } from '../lib/types';
import { Alert, Field, Modal, PageHeader } from '../components/ui';

const LABELS = Object.fromEntries(PERMISSION_GROUPS.flatMap((g) => g.items)) as Record<Permission, string>;

interface RoleForm { id: string | null; name: string; description: string; permissions: Permission[] }

export default function Roles() {
  const { confirm, toast } = useFeedback();
  const { refreshUser } = useAuth();
  const { data, reload } = useFetch(() => api.get<Role[]>('/roles'), []);
  const [editing, setEditing] = useState<RoleForm | null>(null);
  const [error, setError] = useState('');

  const toggle = (p: Permission) => setEditing((f) => (f ? {
    ...f, permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p],
  } : f));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError('');
    try {
      const body = { name: editing.name, description: editing.description, permissions: editing.permissions };
      if (editing.id) await api.put(`/roles/${editing.id}`, body);
      else await api.post('/roles', body);
      setEditing(null);
      reload();
      refreshUser();
    } catch (err) { setError(errorMessage(err)); }
  };

  const remove = async (role: Role) => {
    if (!(await confirm({ title: `Supprimer le rôle « ${role.name} » ?`, confirmLabel: 'Supprimer', danger: true }))) return;
    setError('');
    try { await api.del(`/roles/${role._id}`); reload(); toast('Rôle supprimé.'); } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Rôles & permissions" subtitle="Définissez ce que chaque profil peut faire dans votre entreprise"
        actions={<button className="btn btn-primary" onClick={() => setEditing({ id: null, name: '', description: '', permissions: ['invoices.create'] })}><Plus size={18} /> Nouveau rôle</button>} />
      <Alert>{error}</Alert>

      <div className="stack">
        {data?.map((role) => (
          <div key={role._id} className="card">
            <div className="card-header">
              <div>
                <h3 style={{ margin: 0 }}>{role.isSystem && <Lock size={16} className="muted" />} {role.name}</h3>
                <div className="muted small">{role.description || '—'} · {role.userCount || 0} utilisateur(s)</div>
              </div>
              {!role.isSystem && (
                <div className="row-gap">
                  <button className="icon-btn" title="Modifier" onClick={() => setEditing({ id: role._id, name: role.name, description: role.description, permissions: role.permissions })}><Edit2 size={16} /></button>
                  <button className="icon-btn text-danger" title="Supprimer" onClick={() => remove(role)}><Trash2 size={16} /></button>
                </div>
              )}
            </div>
            <div className="chips">
              {role.permissions.length === 0 && <span className="muted small">Consultation uniquement</span>}
              {role.permissions.map((p) => <span key={p} className="badge badge-info">{LABELS[p] || p}</span>)}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal title={editing.id ? 'Modifier le rôle' : 'Nouveau rôle'} onClose={() => setEditing(null)} width={720}>
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Nom du rôle *"><input className="input-field" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required autoFocus placeholder="Ex : Caissier, Magasinier…" /></Field>
              <Field label="Description"><input className="input-field" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            </div>
            <p className="muted small">Tous les utilisateurs peuvent consulter les factures, clients et produits. Cochez les actions autorisées :</p>
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.title} className="perm-group">
                <h4>{group.title}</h4>
                <div className="perm-grid">
                  {group.items.map(([perm, label]) => (
                    <label key={perm} className="checkbox">
                      <input type="checkbox" checked={editing.permissions.includes(perm)} onChange={() => toggle(perm)} /> {label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
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
