import { useRef, useState, type CSSProperties } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { readImageFile } from '../lib/image';
import { errorMessage } from '../lib/api';
import type { CompanyDraft } from '../lib/company';
import { Alert, Field } from './ui';
import { headerBackground, labelBackground, logoBackground } from '../lib/brand';

const TEXT_FIELDS: [keyof CompanyDraft, string][] = [
  ['legalName', 'Raison sociale (compte bancaire)'], ['address', 'Adresse'], ['city', 'Ville'], ['email', 'E-mail'],
  ['phone', 'Téléphone'], ['taxNumber', 'Numéro d\'impôt'], ['nationalId', 'Identification nationale'], ['rccm', 'RCCM'],
  ['bankName', 'Banque'], ['bankAccount', 'Compte bancaire'],
];

export function ImageInput({ label, value, wide, onChange, previewStyle }: { label: string; value: string; wide?: boolean; onChange: (v: string) => void; previewStyle?: CSSProperties }) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const pick = async (file?: File) => {
    if (!file) return;
    setError('');
    try { onChange(await readImageFile(file, wide ? 1600 : 800)); } catch (err) { setError(errorMessage(err)); }
  };
  return (
    <div className="input-group">
      <span className="label">{label}</span>
      <div className="logo-drop">
        <div className={`logo-preview ${wide ? 'wide' : ''}`} style={value ? previewStyle : undefined}>{value ? <img src={value} alt="" /> : 'Aucune image'}</div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => ref.current?.click()}><ImagePlus size={16} /> Choisir</button>
        {value && <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => onChange('')}><Trash2 size={16} /> Retirer</button>}
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <Alert>{error}</Alert>
    </div>
  );
}

// Aperçu de l'en-tête de facture avec la charte de l'entreprise
function BrandPreview({ form }: { form: CompanyDraft }) {
  return (
    <div className="brand-preview">
      <div style={{ ...headerBackground(form), padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}>
        {form.logo ? <img src={form.logo} alt="" style={{ height: 50, maxWidth: 120, objectFit: 'contain' }} /> : <strong style={{ color: '#fff' }}>{form.name || 'Votre logo'}</strong>}
        <div style={{ width: 2, height: 44, background: '#fff' }} />
        <div style={{ display: 'flex', fontSize: 12, fontWeight: 700 }}>
          <span style={{ background: labelBackground(form), color: '#fff', padding: '4px 10px' }}>FACTURE N°</span>
          <span style={{ background: '#fff', color: '#000', padding: '4px 10px' }}>: FAC-2026-0001</span>
        </div>
      </div>
      <div style={{ margin: '12px 18px 16px', height: 22, background: `linear-gradient(to right, ${form.accentColor} 0%, ${form.primaryColor} 80%, ${form.secondaryColor} 100%)` }} />
    </div>
  );
}

export default function CompanyForm({ form, onChange, showRules = true }: { form: CompanyDraft; onChange: (f: CompanyDraft) => void; showRules?: boolean }) {
  const set = <K extends keyof CompanyDraft>(key: K, value: CompanyDraft[K]) => onChange({ ...form, [key]: value });
  return (
    <div className="grid-2 even">
      <div>
        <h3>Identité visuelle</h3>
        <Field label="Nom de l'entreprise *"><input className="input-field" value={form.name} onChange={(e) => set('name', e.target.value)} required /></Field>
        <ImageInput label="Logo (imprimé sur les factures)" value={form.logo} onChange={(v) => set('logo', v)} previewStyle={logoBackground(form)} />
        <ImageInput label="Bandeau dégradé (en-tête et bas de page, optionnel)" value={form.footerImage} wide onChange={(v) => set('footerImage', v)} />
        <div className="color-row">
          {([['primaryColor', 'Principale'], ['secondaryColor', 'Secondaire'], ['accentColor', 'Accent']] as const).map(([key, label]) => (
            <label key={key} className="color-field">{label}
              <input type="color" value={form[key]} onChange={(e) => set(key, e.target.value)} />
            </label>
          ))}
        </div>
        <span className="label muted small">Aperçu de l'en-tête des factures</span>
        <BrandPreview form={form} />
      </div>
      <div>
        <h3>Coordonnées sur les factures</h3>
        <div className="form-grid">
          {TEXT_FIELDS.map(([key, label]) => (
            <Field key={key} label={label}>
              <input className="input-field" value={String(form[key] ?? '')} onChange={(e) => set(key, e.target.value as never)} />
            </Field>
          ))}
        </div>
        {showRules && (
          <>
            <h3>Gestion</h3>
            <div className="form-grid">
              <Field label="Taux (1 USD = ? FC)"><input type="number" min="0" className="input-field" value={form.exchangeRate} onChange={(e) => set('exchangeRate', parseFloat(e.target.value) || 0)} /></Field>
              <Field label="Devise des rapports">
                <select className="input-field" value={form.reportingCurrency} onChange={(e) => set('reportingCurrency', e.target.value as CompanyDraft['reportingCurrency'])}>
                  <option value="USD">USD</option><option value="FC">FC</option>
                </select>
              </Field>
              <Field label="Délai de paiement (jours)"><input type="number" min="0" className="input-field" value={form.paymentTermDays} onChange={(e) => set('paymentTermDays', parseInt(e.target.value, 10) || 0)} /></Field>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
