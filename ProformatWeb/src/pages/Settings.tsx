import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import type { Settings } from '../lib/types';
import { Alert, Field, PageHeader } from '../components/ui';

const TEXT_FIELDS: [keyof Settings, string][] = [
  ['companyName', 'Nom commercial'], ['legalName', 'Raison sociale (compte bancaire)'], ['address', 'Adresse'], ['city', 'Ville'],
  ['email', 'E-mail'], ['phone', 'Téléphone'], ['taxNumber', 'Numéro d\'impôt'], ['nationalId', 'Identification nationale'],
  ['rccm', 'RCCM'], ['bankName', 'Banque'], ['bankAccount', 'Compte bancaire'],
];

export default function SettingsPage() {
  const { settings, refreshSettings } = useAuth();
  const [form, setForm] = useState<Settings | null>(settings);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  if (!form) return <div className="muted">Chargement…</div>;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.put('/settings', form);
      await refreshSettings();
      setMessage('Paramètres enregistrés.');
    } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Paramètres" subtitle="Informations imprimées sur les factures et règles de gestion" />
      <Alert>{error}</Alert>
      <Alert tone="success">{message}</Alert>
      <form onSubmit={save} className="grid-2 even">
        <div className="card">
          <h3>Entreprise</h3>
          {TEXT_FIELDS.map(([key, label]) => (
            <Field key={key} label={label}>
              <input className="input-field" value={String(form[key] ?? '')} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </Field>
          ))}
        </div>
        <div className="card" style={{ alignSelf: 'start' }}>
          <h3>Gestion</h3>
          <Field label="Taux de change (1 USD = ? FC)" hint="Utilisé par défaut sur les nouvelles factures et pour consolider les rapports">
            <input type="number" min="0" className="input-field" value={form.exchangeRate} onChange={(e) => setForm({ ...form, exchangeRate: parseFloat(e.target.value) || 0 })} />
          </Field>
          <Field label="Devise des rapports">
            <select className="input-field" value={form.reportingCurrency} onChange={(e) => setForm({ ...form, reportingCurrency: e.target.value as Settings['reportingCurrency'] })}>
              <option value="USD">USD</option><option value="FC">FC</option>
            </select>
          </Field>
          <Field label="Délai de paiement par défaut (jours)">
            <input type="number" min="0" className="input-field" value={form.paymentTermDays} onChange={(e) => setForm({ ...form, paymentTermDays: parseInt(e.target.value, 10) || 0 })} />
          </Field>
          <button type="submit" className="btn btn-primary btn-block"><Save size={18} /> Enregistrer</button>
        </div>
      </form>
    </div>
  );
}
