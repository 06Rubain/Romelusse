import { useRef, useState, type CSSProperties } from 'react';
import { CheckCircle2, ImagePlus, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { readImageFile } from '../lib/image';
import { api, errorMessage } from '../lib/api';
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

// Vérifie la clé pawaPay enregistrée : lit les opérateurs (portefeuilles) ouverts sur le compte
function PawapayCheck({ saved }: { saved: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; env: string; message?: string; providers?: { method: string; currencies: string[] }[] } | null>(null);
  const verify = async () => {
    setBusy(true);
    setResult(null);
    try { setResult(await api.post('/company/pawapay/verify')); } catch (err) { setResult({ ok: false, env: '', message: errorMessage(err) }); } finally { setBusy(false); }
  };
  return (
    <div className="pawapay-check">
      <button type="button" className="btn btn-outline btn-sm" onClick={verify} disabled={busy || !saved}>
        <ShieldCheck size={16} /> {busy ? 'Vérification…' : 'Vérifier ma clé pawaPay'}
      </button>
      {!saved && <span className="muted small">Enregistrez d'abord la clé.</span>}
      {result?.ok && (
        <div className="alert alert-success small">
          <strong><CheckCircle2 size={15} /> Connexion à pawaPay réussie ({result.env === 'live' ? 'réel' : 'test'}).</strong>
          {result.providers?.length ? (
            <div>Opérateurs ouverts sur votre compte : {result.providers.map((p) => `${p.method} (${p.currencies.join(', ')})`).join(' · ')}</div>
          ) : <div>Aucun portefeuille Mobile Money ouvert en RDC sur ce compte : activez-les dans pawaPay (Finances → Wallets).</div>}
        </div>
      )}
      {result && !result.ok && <div className="alert alert-danger small">{result.message}</div>}
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

export default function CompanyForm({ form, onChange, showRules = true, tokenSet = false, pawapayTokenSet = false }: { form: CompanyDraft; onChange: (f: CompanyDraft) => void; showRules?: boolean; tokenSet?: boolean; pawapayTokenSet?: boolean }) {
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
        <h3>Page de paiement en ligne</h3>
        <p className="muted small" style={{ marginTop: -6 }}>Le client paie depuis le lien de sa facture, sur une page à vos couleurs : il choisit M-Pesa, Orange Money, Airtel Money, Africell Money ou la carte, confirme sur son téléphone, et la facture passe en « Payée » toute seule.</p>
        <div className="segmented" role="radiogroup" aria-label="Paiement en ligne" style={{ marginBottom: 12 }}>
          {([['off', 'Désactivé'], ['demo', 'Essai (sans argent)'], ['live', 'Réel']] as const).map(([mode, label]) => (
            <button key={mode} type="button" role="radio" aria-checked={form.checkoutMode === mode} className={form.checkoutMode === mode ? 'active' : ''}
              onClick={() => set('checkoutMode', mode)}>{label}</button>
          ))}
        </div>
        {form.checkoutMode === 'demo' && (
          <div className="alert alert-info small">Mode essai : la page de paiement fonctionne mais aucun argent ne bouge. Le paiement est accepté après quelques secondes (un numéro qui finit par 000 est refusé). Passez en « Réel » quand FlexPaie vous a donné vos identifiants.</div>
        )}
        {form.checkoutMode === 'live' && (
          <>
            <span className="label">Prestataire de paiement</span>
            <div className="segmented" role="radiogroup" aria-label="Prestataire" style={{ margin: '6px 0 12px' }}>
              {([['pawapay', 'pawaPay (test gratuit)'], ['flexpay', 'FlexPaie']] as const).map(([p, label]) => (
                <button key={p} type="button" role="radio" aria-checked={form.paymentProvider === p} className={form.paymentProvider === p ? 'active' : ''}
                  onClick={() => set('paymentProvider', p)}>{label}</button>
              ))}
            </div>
          </>
        )}
        {form.checkoutMode === 'live' && form.paymentProvider === 'pawapay' && (
          <>
            <ol className="setup-steps small">
              <li>Créez votre compte gratuit sur <a href="https://dashboard.sandbox.pawapay.io" target="_blank" rel="noreferrer">dashboard.sandbox.pawapay.io</a> (test) ; le compte réel s'ouvre après validation de votre entreprise par pawaPay.</li>
              <li>Dans le tableau de bord pawaPay : <strong>System configuration → API tokens</strong>, générez une clé et collez-la ci-dessous.</li>
              <li>Dans <strong>Callback URLs → Deposits</strong>, collez : <code>{`${window.location.origin}/api/public/pawapay/callback`}</code></li>
              <li>Vos clients voient les opérateurs ouverts sur votre compte (<strong>Finances → Wallets</strong> : M-Pesa, Orange, Airtel, Africell…), selon la devise de la facture.</li>
            </ol>
            <div className="form-grid">
              <Field label="Environnement pawaPay">
                <select className="input-field" value={form.pawapayEnv} onChange={(e) => set('pawapayEnv', e.target.value as CompanyDraft['pawapayEnv'])}>
                  <option value="sandbox">Test (gratuit)</option>
                  <option value="live">Réel (argent encaissé)</option>
                </select>
              </Field>
              <Field label="Clé API pawaPay" hint={pawapayTokenSet ? 'Une clé est enregistrée. Saisissez-en une nouvelle seulement pour la remplacer.' : 'Chiffrée et gardée secrète sur le serveur.'}>
                <input className="input-field" type="password" value={form.pawapayToken || ''} onChange={(e) => set('pawapayToken', e.target.value)}
                  placeholder={pawapayTokenSet ? '•••••••• enregistrée' : 'Collez la clé ici'} autoComplete="new-password" />
              </Field>
            </div>
            {form.pawapayEnv === 'sandbox' && (
              <div className="alert alert-info small">Environnement de test : la page de paiement appelle vraiment pawaPay, mais aucun argent ne bouge et la facture ne change pas. Numéro de test M-Pesa qui réussit : <strong>0973456789</strong>.</div>
            )}
            <PawapayCheck saved={pawapayTokenSet} />
            {!(pawapayTokenSet || form.pawapayToken) && (
              <div className="alert alert-warning small">Tant que la clé pawaPay n'est pas enregistrée, la page de paiement propose seulement vos numéros et « J'ai payé ».</div>
            )}
          </>
        )}
        {form.checkoutMode === 'live' && form.paymentProvider === 'flexpay' && (
          <div className="form-grid">
            <Field label="Code marchand FlexPaie" hint="Ex. : FPG_DRC (fourni par FlexPaie)">
              <input className="input-field" value={form.flexpayMerchant} onChange={(e) => set('flexpayMerchant', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Clé API (jeton) FlexPaie" hint={tokenSet ? 'Une clé est enregistrée. Saisissez-en une nouvelle seulement pour la remplacer.' : 'Demandez-la à FlexPaie (espace marchand). Elle reste secrète sur le serveur.'}>
              <input className="input-field" type="password" value={form.flexpayToken || ''} onChange={(e) => set('flexpayToken', e.target.value)}
                placeholder={tokenSet ? '•••••••• enregistrée' : 'Collez la clé ici'} autoComplete="new-password" />
            </Field>
          </div>
        )}
        {form.checkoutMode === 'live' && form.paymentProvider === 'flexpay' && (!form.flexpayMerchant || !(tokenSet || form.flexpayToken)) && (
          <div className="alert alert-warning small">Tant que le code marchand et la clé ne sont pas enregistrés, la page de paiement propose seulement vos numéros et « J'ai payé ».</div>
        )}
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
