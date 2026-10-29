import { useEffect, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useFeedback } from '../components/feedback';
import ResetDataModal from '../components/ResetDataModal';
import { Alert, PageHeader } from '../components/ui';
import CompanyForm from '../components/CompanyForm';
import { toDraft, type CompanyDraft } from '../lib/company';

export default function SettingsPage() {
  const { company, refreshCompany } = useAuth();
  const [form, setForm] = useState<CompanyDraft | null>(company ? toDraft(company) : null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { toast } = useFeedback();

  useEffect(() => { if (company) setForm(toDraft(company)); }, [company]);

  if (!form) return <div className="muted">Chargement…</div>;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await api.put('/company', form);
      await refreshCompany();
      setMessage('Paramètres enregistrés : vos prochaines factures utilisent cette présentation.');
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <>
    <form className="animate-fade-in" onSubmit={save}>
      <PageHeader title="Entreprise & logo" subtitle="Personnalisez vos factures et proformas"
        actions={<button type="submit" className="btn btn-primary" disabled={busy}><Save size={18} /> {busy ? 'Enregistrement…' : 'Enregistrer'}</button>} />
      <Alert>{error}</Alert>
      <Alert tone="success">{message}</Alert>
      <div className="card"><CompanyForm form={form} onChange={setForm} /></div>
    </form>

    <div className="card danger-zone">
      <div>
        <h3>Effacer les données de test</h3>
        <p className="muted">Avant de commencer pour de bon, supprimez les factures, encaissements, dépenses, clients ou produits saisis pour essayer. Les comptes, les rôles, le logo et le modèle de facture sont conservés.</p>
      </div>
      <button type="button" className="btn btn-danger-soft" onClick={() => setResetting(true)}><Trash2 size={16} /> Effacer des données…</button>
    </div>
    {resetting && company && (
      <ResetDataModal companyName={company.name} endpoint="/company/reset" onClose={() => setResetting(false)}
        onDone={(summary) => { setResetting(false); toast(summary); }} />
    )}
    </>
  );
}
