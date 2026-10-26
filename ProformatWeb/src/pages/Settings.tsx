import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { Alert, PageHeader } from '../components/ui';
import CompanyForm from '../components/CompanyForm';
import { toDraft, type CompanyDraft } from '../lib/company';

export default function SettingsPage() {
  const { company, refreshCompany } = useAuth();
  const [form, setForm] = useState<CompanyDraft | null>(company ? toDraft(company) : null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    <form className="animate-fade-in" onSubmit={save}>
      <PageHeader title="Entreprise & logo" subtitle="Personnalisez vos factures et proformas"
        actions={<button type="submit" className="btn btn-primary" disabled={busy}><Save size={18} /> {busy ? 'Enregistrement…' : 'Enregistrer'}</button>} />
      <Alert>{error}</Alert>
      <Alert tone="success">{message}</Alert>
      <div className="card"><CompanyForm form={form} onChange={setForm} /></div>
    </form>
  );
}
