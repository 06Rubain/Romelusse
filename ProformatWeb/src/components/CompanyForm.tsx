import { useRef, useState, type CSSProperties } from 'react';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { readImageFile } from '../lib/image';
import { errorMessage } from '../lib/api';
import type { CompanyDraft } from '../lib/company';
import { ACCOUNT_PROVIDERS, ONLINE_PAYMENT_METHODS, type PaymentAccount } from '../lib/types';
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

// Numéros Mobile Money et comptes où les clients paient directement
function PaymentAccountsEditor({ value, onChange }: { value: PaymentAccount[]; onChange: (v: PaymentAccount[]) => void }) {
  const update = (i: number, patch: Partial<PaymentAccount>) => onChange(value.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const used = new Set(value.map((a) => a.provider));
  const next = ACCOUNT_PROVIDERS.find((p) => !used.has(p)) || 'Autre';
  return (
    <div className="input-group">
      <span className="label">Nos numéros et comptes</span>
      <p className="muted small" style={{ margin: '0 0 8px' }}>Affichés sur la page de paiement du client et imprimés sur les factures. Le client y envoie l'argent puis appuie sur « J'ai payé ».</p>
      <div className="account-rows">
        {value.map((a, i) => (
          <div key={i} className="account-row">
            <select className="input-field" value={a.provider} aria-label="Opérateur" onChange={(e) => update(i, { provider: e.target.value as PaymentAccount['provider'] })}>
              {ACCOUNT_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input className="input-field" value={a.number} aria-label="Numéro ou compte" placeholder={a.provider === 'Banque' ? 'N° de compte' : 'Ex : 0990 000 000'}
              inputMode={a.provider === 'Banque' || a.provider === 'Autre' ? 'text' : 'tel'} onChange={(e) => update(i, { number: e.target.value })} />
            <input className="input-field" value={a.holder} aria-label="Au nom de" placeholder="Au nom de" onChange={(e) => update(i, { holder: e.target.value })} />
            {(a.provider === 'Banque' || a.provider === 'Autre') && (
              <input className="input-field" value={a.label} aria-label="Nom de la banque ou du service" placeholder={a.provider === 'Banque' ? 'Nom de la banque' : 'Nom du service'} onChange={(e) => update(i, { label: e.target.value })} />
            )}
            <button type="button" className="icon-btn text-danger" title="Retirer" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 size={17} /></button>
          </div>
        ))}
      </div>
      {value.length < 8 && (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange([...value, { provider: next, number: '', holder: '', label: '' }])}>
          <Plus size={16} /> Ajouter un numéro ou un compte
        </button>
      )}
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
        <ImageInput label="Signature (et cachet) de la direction" value={form.signature} onChange={(v) => set('signature', v)} />
        <p className="muted small" style={{ marginTop: -8 }}>Photographiez la signature sur une feuille blanche ; un PNG à fond transparent donne le meilleur rendu. Elle est imprimée au-dessus de « La direction ».</p>
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
        <h3>Paiement des clients</h3>
        <PaymentAccountsEditor value={form.paymentAccounts || []} onChange={(v) => set('paymentAccounts', v)} />
        <Field label="Lien de paiement en ligne (carte, Mobile Money)" hint="Imprimé sur les factures avec un QR code et ajouté au message WhatsApp. Ex. : vpos.flexpaie.com/pay/FPG_DRC">
          <input className="input-field" value={form.paymentLink} onChange={(e) => set('paymentLink', e.target.value)} placeholder="vpos.flexpaie.com/pay/…" />
        </Field>
        <div className="input-group">
          <span className="label">Moyens acceptés par ce lien</span>
          <div className="choice-chips">
            {ONLINE_PAYMENT_METHODS.map((m) => {
              const on = form.paymentMethods.includes(m);
              return (
                <button key={m} type="button" className={on ? 'active' : ''} aria-pressed={on}
                  onClick={() => set('paymentMethods', on ? form.paymentMethods.filter((x) => x !== m) : [...form.paymentMethods, m])}>{m}</button>
              );
            })}
          </div>
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
