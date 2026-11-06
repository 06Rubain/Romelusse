import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { Alert, Modal } from './ui';

const SCOPES: [string, string][] = [
  ['sales', 'Factures, proformas et encaissements (la numérotation repart à 0001)'],
  ['money', 'Dépenses et mouvements de trésorerie'],
  ['clients', 'Clients'],
  ['products', 'Produits et mouvements de stock'],
  ['activities', 'Journal d\'activité'],
];

const LABELS: Record<string, string> = {
  invoices: 'documents', payments: 'encaissements', counters: 'compteurs', expenses: 'dépenses', cashMovements: 'mouvements de trésorerie',
  clients: 'clients', products: 'produits', stockMovements: 'mouvements de stock', activities: 'lignes de journal',
};

// Effacement des données de test d'une entreprise : choix de ce qui est effacé, confirmation par le nom de l'entreprise
export default function ResetDataModal({ companyName, endpoint, onClose, onDone }: { companyName: string; endpoint: string; onClose: () => void; onDone: (summary: string) => void }) {
  const [scopes, setScopes] = useState<string[]>(SCOPES.map(([k]) => k));
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const matches = confirm.trim().toLowerCase() === companyName.trim().toLowerCase();

  const toggle = (key: string) => setScopes((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post<{ deleted: Record<string, number> }>(endpoint, { scopes, confirm });
      const summary = Object.entries(res.deleted).filter(([k]) => k !== 'counters').map(([k, n]) => `${n} ${LABELS[k] || k}`).join(', ');
      onDone(summary ? `Effacé : ${summary}.` : 'Données effacées.');
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Modal title="Effacer les données de test" onClose={onClose} width={560}>
      <form onSubmit={submit}>
        <div className="danger-note">
          <AlertTriangle size={20} />
          <span>Effacement <strong>définitif</strong> pour <strong>{companyName}</strong>. L'entreprise, ses utilisateurs, ses rôles, son logo et son modèle de facture sont conservés.</span>
        </div>
        <Alert>{error}</Alert>
        <div className="check-list">
          {SCOPES.map(([key, label]) => (
            <label key={key} className="check-item">
              <input type="checkbox" checked={scopes.includes(key)} onChange={() => toggle(key)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <label className="input-group">
          <span className="label">Pour confirmer, tapez le nom de l'entreprise : <strong>{companyName}</strong></span>
          <input className="input-field" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" placeholder={companyName} />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-danger" disabled={busy || !matches || !scopes.length}>
            <Trash2 size={16} /> {busy ? 'Effacement…' : 'Effacer définitivement'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
