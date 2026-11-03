import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, Loader2, Lock, ShieldCheck, Smartphone, XCircle } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { formatMoney } from '../lib/format';
import { PROVIDER_COLORS, type AccountProvider, type Currency } from '../lib/types';

const CARD = 'Carte bancaire';
const POLL_MS = 3000;
const WAIT_LIMIT_MS = 3 * 60 * 1000;

interface Online {
  id: string; status: 'En cours' | 'Réussi' | 'Échoué'; message: string; method: string; channel: 'mobile' | 'card';
  amount: number; currency: Currency; mode: 'demo' | 'live'; phone: string; redirectUrl?: string | null;
}

const colorOf = (method: string) => (method === CARD ? '#1a1f71' : PROVIDER_COLORS[method as AccountProvider] || PROVIDER_COLORS.Autre);

// Paiement sur la page du client : choix du moyen, numéro, confirmation sur le téléphone, reçu
export default function Checkout({ token, methods, mode, amount, currency, brand, onPaid }: {
  token: string; methods: string[]; mode: 'demo' | 'live'; amount: number; currency: Currency; brand: string; onPaid: () => void;
}) {
  const [method, setMethod] = useState('');
  const [phone, setPhone] = useState('');
  const [online, setOnline] = useState<Online | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const startedAt = useRef(0);

  // Retour de la page carte (ou page rouverte) : on reprend le suivi du paiement
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('paiement');
    if (!id) return;
    api.get<Online>(`/public/invoices/${token}/checkout/${id}`).then((o) => { setOnline(o); setMethod(o.method); startedAt.current = Date.now(); }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!online || online.status !== 'En cours') return undefined;
    const timer = setInterval(async () => {
      try {
        const next = await api.get<Online>(`/public/invoices/${token}/checkout/${online.id}`);
        if (next.status !== 'En cours') { setOnline(next); if (next.status === 'Réussi' && next.mode === 'live') onPaid(); }
        if (Date.now() - startedAt.current > WAIT_LIMIT_MS) setSlow(true);
      } catch { /* connexion instable : on réessaie au prochain passage */ }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [online, token, onPaid]);

  const pay = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const started = await api.post<Online>(`/public/invoices/${token}/checkout`, { method, phone });
      if (started.redirectUrl) { window.location.href = started.redirectUrl; return; }
      startedAt.current = Date.now();
      setSlow(false);
      setOnline(started);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const restart = () => { setOnline(null); setError(''); window.history.replaceState(null, '', window.location.pathname); };
  const total = formatMoney(amount, currency);

  if (online?.status === 'Réussi' && online.mode === 'demo') {
    return (
      <div className="checkout checkout-done">
        <CheckCircle2 size={56} />
        <h2>Essai réussi</h2>
        <p>Voici ce que verra votre client après un vrai paiement de <strong>{formatMoney(online.amount, online.currency)}</strong> par {online.method}.</p>
        <p className="muted small">Mode essai : aucun argent n'a été débité et la facture n'a pas changé.</p>
        <button type="button" className="btn btn-outline btn-sm" onClick={restart}>Refaire un essai</button>
      </div>
    );
  }

  if (online?.status === 'Réussi') {
    return (
      <div className="checkout checkout-done">
        <CheckCircle2 size={56} />
        <h2>Paiement reçu, merci !</h2>
        <p><strong>{formatMoney(online.amount, online.currency)}</strong> payés par {online.method}.</p>
        <p className="muted small">{brand} a reçu votre paiement : votre facture est réglée.</p>
      </div>
    );
  }

  if (online?.status === 'En cours') {
    return (
      <div className="checkout checkout-wait" style={{ ['--method' as string]: colorOf(online.method) }}>
        <div className="checkout-pulse"><Smartphone size={30} /></div>
        {online.channel === 'mobile' ? (
          <>
            <h2>Confirmez sur votre téléphone</h2>
            <p>Une demande de paiement de <strong>{formatMoney(online.amount, online.currency)}</strong> a été envoyée au <strong>{online.phone}</strong> ({online.method}).</p>
            <p className="muted small">Ouvrez la notification ou le message reçu et saisissez votre code secret {online.method} pour valider.</p>
          </>
        ) : (
          <><h2>Vérification du paiement…</h2><p className="muted small">Nous attendons la confirmation de votre banque.</p></>
        )}
        <div className="checkout-status"><Loader2 size={16} className="spin" /> En attente de la confirmation…</div>
        {slow && <p className="muted small">Toujours rien ? Vous pouvez fermer cette page : la facture sera mise à jour dès que le paiement arrive.</p>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>Changer de moyen de paiement</button>
      </div>
    );
  }

  return (
    <div className="checkout">
      {mode === 'demo' && <div className="checkout-demo">MODE ESSAI : aucun paiement réel</div>}
      {online?.status === 'Échoué' && (
        <div className="pay-status danger"><XCircle size={22} /><div><strong>Paiement non abouti</strong><div>{online.message || 'Réessayez ou choisissez un autre moyen.'}</div></div></div>
      )}
      {!method ? (
        <>
          <div className="checkout-title">Choisissez votre moyen de paiement</div>
          <div className="checkout-methods">
            {methods.map((m) => (
              <button key={m} type="button" className="checkout-method" style={{ ['--method' as string]: colorOf(m) }} onClick={() => { setMethod(m); setError(''); }}>
                <span className="checkout-method-icon">{m === CARD ? <CreditCard size={20} /> : <Smartphone size={20} />}</span>
                <span>{m === CARD ? <>Carte bancaire<small>Visa · Mastercard</small></> : m}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <form className="checkout-form" style={{ ['--method' as string]: colorOf(method) }} onSubmit={pay}>
          <button type="button" className="btn btn-ghost btn-sm checkout-back" onClick={() => { setMethod(''); setError(''); }}><ArrowLeft size={16} /> Autre moyen</button>
          <div className="checkout-chosen">
            <span className="checkout-method-icon">{method === CARD ? <CreditCard size={20} /> : <Smartphone size={20} />}</span>
            <strong>{method}</strong>
          </div>
          {method === CARD ? (
            <p className="muted small">Vous allez saisir votre carte sur la page sécurisée de notre partenaire de paiement, puis revenir ici.</p>
          ) : (
            <label className="input-group">
              <span className="label">Votre numéro {method}</span>
              <div className="phone-input">
                <span>+243</span>
                <input className="input-field" inputMode="tel" autoComplete="tel" placeholder="99 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus />
              </div>
            </label>
          )}
          {error && <div className="alert alert-danger">{error}</div>}
          <button className="btn btn-block btn-lg checkout-pay" disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" /> : <Lock size={18} />} {busy ? 'Envoi…' : `Payer ${total}`}
          </button>
        </form>
      )}
      <div className="checkout-secure">
        <ShieldCheck size={15} /> {mode === 'demo' ? 'Mode essai : aucun argent réel n\'est débité.' : 'Paiement sécurisé par FlexPaie. Votre code secret n\'est jamais demandé sur cette page.'}
      </div>
    </div>
  );
}
