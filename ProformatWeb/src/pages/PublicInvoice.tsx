import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, CheckCircle2, Clock, Copy, CreditCard, Download, ExternalLink, FileText, Phone, Send, Smartphone, XCircle } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { formatDate, formatMoney } from '../lib/format';
import { headerBackground, logoBackground } from '../lib/brand';
import { DOC_INFO, PROVIDER_COLORS, type DocType, type Company, type Currency, type InvoiceStatus, type InvoiceTemplate, type NoticeStatus, type PaymentAccount } from '../lib/types';
import InvoiceDocument from '../components/InvoiceDocument';
import TemplateDocument from '../components/TemplateDocument';
import Checkout from '../components/Checkout';

interface PublicData {
  invoice: {
    number: string; type: DocType; client: string; clientActivity: string; issueDate: string; dueDate: string | null;
    currency: Currency; products: { name: string; quantity: number; unitPrice: number }[]; subtotal: number; discount: number;
    totalAmount: number; amountPaid: number; balance: number; status: InvoiceStatus; notes: string;
  };
  company: Company;
  template: InvoiceTemplate | null;
  notices: ClientNotice[];
  checkout: { mode: 'demo' | 'sandbox' | 'live'; provider: string; methods: string[] } | null;
}

interface ClientNotice { provider: string; amount: number; currency: Currency; reference: string; status: NoticeStatus; createdAt: string }

const ONLINE = 'Paiement en ligne';

const DOC_WIDTH = 800;

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-outline btn-sm" onClick={async () => {
      try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* copie impossible : la valeur reste affichée */ }
    }}>
      {done ? <Check size={15} /> : <Copy size={15} />} {done ? 'Copié' : label}
    </button>
  );
}

// Un compte de l'entreprise : opérateur, numéro à copier, titulaire
function AccountCard({ account }: { account: PaymentAccount }) {
  const color = PROVIDER_COLORS[account.provider] || PROVIDER_COLORS.Autre;
  return (
    <div className="pay-account" style={{ ['--provider' as string]: color }}>
      <span className="pay-account-icon">{account.provider === 'Banque' ? <CreditCard size={18} /> : <Smartphone size={18} />}</span>
      <div className="pay-account-body">
        <span className="pay-account-name">{account.label || account.provider}</span>
        <strong className="pay-account-number">{account.number}</strong>
        {account.holder && <span className="muted small">Au nom de {account.holder}</span>}
      </div>
      <CopyButton value={account.number.replace(/\s/g, '')} label="Copier" />
    </div>
  );
}

const NOTICE_TEXT: Record<NoticeStatus, string> = {
  'En attente': 'en cours de vérification', Confirmé: 'confirmé, merci', Refusé: 'non retrouvé : appelez-nous',
};

// « J'ai payé » : le client indique le moyen utilisé et la référence reçue par SMS ; l'entreprise vérifie puis confirme
function NoticeForm({ token, providers, due, currency, onSent }: { token: string; providers: string[]; due: number; currency: Currency; onSent: (n: ClientNotice[]) => void }) {
  const [provider, setProvider] = useState(providers[0] || '');
  const [amount, setAmount] = useState(String(due));
  const [reference, setReference] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ notices: ClientNotice[] }>(`/public/invoices/${token}/notices`, { provider, amount, reference, payerName, payerPhone });
      onSent(res.notices);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="pay-notice-form" onSubmit={submit}>
      <strong>Vous avez payé ? Prévenez-nous</strong>
      <label className="input-group"><span className="label">Moyen utilisé</span>
        <select className="input-field" value={provider} onChange={(e) => setProvider(e.target.value)}>
          {providers.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <div className="pay-notice-grid">
        <label className="input-group"><span className="label">Montant payé ({currency})</span>
          <input className="input-field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label className="input-group"><span className="label">Référence de la transaction</span>
          <input className="input-field" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reçue par SMS" required minLength={3} />
        </label>
        <label className="input-group"><span className="label">Votre nom (facultatif)</span>
          <input className="input-field" value={payerName} onChange={(e) => setPayerName(e.target.value)} autoComplete="name" />
        </label>
        <label className="input-group"><span className="label">Numéro qui a payé (facultatif)</span>
          <input className="input-field" inputMode="tel" value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} autoComplete="tel" />
        </label>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      <button className="btn btn-primary btn-block" disabled={busy}><Send size={18} /> {busy ? 'Envoi…' : 'Envoyer'}</button>
    </form>
  );
}

// Page ouverte par le client depuis le lien reçu : voir sa facture et la payer, sans compte
export default function PublicInvoice() {
  const { token = '' } = useParams();
  const { data, error, loading, reload } = useFetch(() => api.get<PublicData>(`/public/invoices/${token}`), [token]);
  const [showDoc, setShowDoc] = useState(false);
  const [sentNotices, setSentNotices] = useState<ClientNotice[] | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const onPaid = useCallback(() => { setJustPaid(true); reload(); }, [reload]);
  const docRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => setScale(Math.min(1, el.clientWidth / DOC_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [showDoc, data]);

  if (loading && !data) return <div className="pay-page"><div className="pay-card"><p className="muted">Chargement de votre facture…</p></div></div>;
  if (error || !data) {
    return (
      <div className="pay-page">
        <div className="pay-card pay-center">
          <XCircle size={40} className="text-danger" />
          <h1>Lien introuvable</h1>
          <p className="muted">{error || 'Ce lien de facture n\'est pas valide.'} Demandez un nouveau lien à l'entreprise qui vous l'a envoyé.</p>
        </div>
      </div>
    );
  }

  const { invoice, company, template } = data;
  // Proforma ou bon de commande : on présente le montant total, sans reste à payer
  const isProforma = invoice.type !== 'Facture';
  const paid = invoice.status === 'Payée';
  const cancelled = invoice.status === 'Annulée';
  const converted = invoice.status === 'Convertie';
  const due = isProforma ? invoice.totalAmount : invoice.balance;
  const payable = !paid && !cancelled && !converted && due > 0;
  const amount = formatMoney(due, invoice.currency);
  const lines = invoice.products.map((p) => ({ name: p.name, quantity: p.quantity, unitPrice: p.unitPrice }));
  const accounts = company.paymentAccounts || [];
  const notices = sentNotices || data.notices || [];
  const noticeProviders = [...new Set(accounts.map((a) => a.provider)), ...(company.paymentLink ? [ONLINE] : [])];
  const canNotify = !isProforma && payable && noticeProviders.length > 0;
  const checkoutOn = !!data.checkout && invoice.type === 'Facture';
  const firstPhone = (company.phone || '').split(/[/,;]/)[0].replace(/[^\d+]/g, '');

  return (
    <div className="pay-page">
      <div className="pay-card">
        <header className="pay-hero" style={headerBackground(company)}>
          {company.logo
            ? <img src={company.logo} alt="" className="pay-logo" style={logoBackground(company)} />
            : <span className="pay-logo placeholder">{company.name.charAt(0).toUpperCase()}</span>}
          <div>
            <div className="pay-hero-name">{company.name}</div>
            <div className="pay-hero-sub">{[company.city, company.phone].filter(Boolean).join(' · ')}</div>
          </div>
        </header>

        <div className="pay-doc-title">
          <span className="muted small">{DOC_INFO[invoice.type].choice} {invoice.number}</span>
          <span className="muted small">{formatDate(invoice.issueDate)}</span>
        </div>
        <p className="pay-hello">Bonjour <strong>{invoice.client}</strong>,</p>

        {paid && !justPaid && <div className="pay-status success"><CheckCircle2 size={22} /><div><strong>Facture réglée</strong><div>Merci pour votre paiement de {formatMoney(invoice.totalAmount, invoice.currency)}.</div></div></div>}
        {cancelled && <div className="pay-status danger"><XCircle size={22} /><div><strong>Facture annulée</strong><div>Aucun paiement n'est demandé.</div></div></div>}
        {converted && <div className="pay-status info"><FileText size={22} /><div><strong>Document accepté</strong><div>{DOC_INFO[invoice.type].the.replace(/^./, (c) => c.toUpperCase())} a été transformé(e) en facture : demandez le nouveau lien à {company.name}.</div></div></div>}

        {payable && (
            <div className="pay-amount">
              <span className="muted">{invoice.type === 'Proforma' ? 'Montant du devis' : invoice.type === 'Bon de commande' ? 'Montant de la commande' : 'Montant à payer'}</span>
              <strong>{amount}</strong>
              {!isProforma && invoice.amountPaid > 0 && <span className="muted small">Déjà payé : {formatMoney(invoice.amountPaid, invoice.currency)} sur {formatMoney(invoice.totalAmount, invoice.currency)}</span>}
              {!isProforma && invoice.dueDate && <span className="muted small">À payer avant le {formatDate(invoice.dueDate)}</span>}
            </div>
        )}

        {checkoutOn && (payable || justPaid) && (
          <Checkout token={token} methods={data.checkout!.methods} mode={data.checkout!.mode} provider={data.checkout!.provider} amount={due} currency={invoice.currency}
            brand={company.name} onPaid={onPaid} />
        )}

        {payable && (checkoutOn ? (
          (accounts.length > 0 || canNotify) && (
            <details className="pay-more">
              <summary>Autres façons de payer (envoi direct sur nos numéros)</summary>
            {accounts.length > 0 && (
              <div className="pay-direct">
                <strong>{company.paymentLink ? 'Ou envoyez directement sur nos numéros' : 'Payez sur nos numéros'}</strong>
                <div className="pay-accounts">{accounts.map((a, i) => <AccountCard key={i} account={a} />)}</div>
                <p className="muted small">Envoyez <strong>{amount}</strong> et indiquez le motif <strong>{invoice.number}</strong>.</p>
              </div>
            )}

            {(company.paymentLink || accounts.length > 0) && (
              <div className="row-gap pay-copy">
                <CopyButton value={invoice.number} label="Copier la référence" />
                <CopyButton value={String(due)} label="Copier le montant" />
              </div>
            )}

            {!company.paymentLink && !accounts.length && (company.bankName || company.bankAccount) && (
              <div className="pay-bank">
                <strong>Paiement par virement</strong>
                <div>{company.bankName} : {company.bankAccount}</div>
                {company.legalName && <div className="muted small">Au nom de {company.legalName} · référence {invoice.number}</div>}
              </div>
            )}

            {canNotify && (sentNotices ? (
              <div className="pay-status info"><CheckCircle2 size={22} /><div><strong>Merci, c'est noté !</strong><div>{company.name} vérifie votre paiement et met votre facture à jour.</div></div></div>
            ) : noticeOpen ? (
              <NoticeForm token={token} providers={noticeProviders} due={due} currency={invoice.currency} onSent={setSentNotices} />
            ) : (
              <button type="button" className="btn btn-whatsapp btn-block btn-lg pay-paid" onClick={() => setNoticeOpen(true)}><CheckCircle2 size={20} /> J'ai payé</button>
            ))}
            </details>
          )
        ) : (
          <>
            {company.paymentLink && (
              <div className="pay-online">
                <a className="btn btn-primary btn-block btn-lg pay-button" href={company.paymentLink} target="_blank" rel="noreferrer">
                  <CreditCard size={20} /> Payer en ligne <ExternalLink size={16} />
                </a>
                {company.paymentMethods?.length > 0 && (
                  <div className="pay-methods">{company.paymentMethods.map((m) => <span key={m}>{m}</span>)}</div>
                )}
                <ol className="pay-steps">
                  <li>Appuyez sur <strong>Payer en ligne</strong> : la page de paiement sécurisée s'ouvre.</li>
                  <li>Choisissez votre moyen : Mobile Money ou carte bancaire.</li>
                  <li>Saisissez le montant <strong>{amount}</strong> et la référence <strong>{invoice.number}</strong>.</li>
                </ol>
              </div>
            )}
            {accounts.length > 0 && (
              <div className="pay-direct">
                <strong>{company.paymentLink ? 'Ou envoyez directement sur nos numéros' : 'Payez sur nos numéros'}</strong>
                <div className="pay-accounts">{accounts.map((a, i) => <AccountCard key={i} account={a} />)}</div>
                <p className="muted small">Envoyez <strong>{amount}</strong> et indiquez le motif <strong>{invoice.number}</strong>.</p>
              </div>
            )}

            {(company.paymentLink || accounts.length > 0) && (
              <div className="row-gap pay-copy">
                <CopyButton value={invoice.number} label="Copier la référence" />
                <CopyButton value={String(due)} label="Copier le montant" />
              </div>
            )}

            {!company.paymentLink && !accounts.length && (company.bankName || company.bankAccount) && (
              <div className="pay-bank">
                <strong>Paiement par virement</strong>
                <div>{company.bankName} : {company.bankAccount}</div>
                {company.legalName && <div className="muted small">Au nom de {company.legalName} · référence {invoice.number}</div>}
              </div>
            )}

            {canNotify && (sentNotices ? (
              <div className="pay-status info"><CheckCircle2 size={22} /><div><strong>Merci, c'est noté !</strong><div>{company.name} vérifie votre paiement et met votre facture à jour.</div></div></div>
            ) : noticeOpen ? (
              <NoticeForm token={token} providers={noticeProviders} due={due} currency={invoice.currency} onSent={setSentNotices} />
            ) : (
              <button type="button" className="btn btn-whatsapp btn-block btn-lg pay-paid" onClick={() => setNoticeOpen(true)}><CheckCircle2 size={20} /> J'ai payé</button>
            ))}
          </>
        ))}

        {notices.length > 0 && (
          <div className="pay-notices">
            {notices.map((n, i) => (
              <div key={i} className={`pay-notice ${n.status === 'Confirmé' ? 'ok' : n.status === 'Refusé' ? 'ko' : ''}`}>
                {n.status === 'Confirmé' ? <CheckCircle2 size={16} /> : n.status === 'Refusé' ? <XCircle size={16} /> : <Clock size={16} />}
                <span>{formatMoney(n.amount, n.currency)} par {n.provider} (réf. {n.reference}) : {NOTICE_TEXT[n.status]}</span>
              </div>
            ))}
          </div>
        )}

        <div className="pay-actions">
          <button type="button" className="btn btn-outline btn-block" onClick={() => setShowDoc((v) => !v)}>
            <FileText size={18} /> {showDoc ? 'Masquer la facture' : `Voir ${DOC_INFO[invoice.type].the}`}
          </button>
          {firstPhone && (
            <a className="btn btn-ghost btn-block" href={`tel:${firstPhone}`}><Phone size={18} /> Appeler {company.name}</a>
          )}
        </div>

        {showDoc && (
          <div className="pay-doc">
            <div ref={wrapRef} className="pay-doc-wrap">
              <div className="pay-doc-zoom" style={{ ['--doc-zoom' as string]: scale }}>
                {template ? (
                  <TemplateDocument ref={docRef} template={template} company={company} data={{
                    type: invoice.type, number: invoice.number, client: invoice.client, clientActivity: invoice.clientActivity,
                    issueDate: invoice.issueDate, dueDate: invoice.dueDate, currency: invoice.currency, lines,
                    discount: invoice.discount, paid, cancelled, notes: invoice.notes,
                  }} />
                ) : (
                  <InvoiceDocument ref={docRef} type={invoice.type} number={invoice.number} client={invoice.client} clientActivity={invoice.clientActivity}
                    issueDate={invoice.issueDate} dueDate={invoice.dueDate} currency={invoice.currency} lines={lines} discount={invoice.discount}
                    paid={paid} cancelled={cancelled} notes={invoice.notes} company={company} printFormat="A4" />
                )}
              </div>
            </div>
            <button type="button" className="btn btn-outline btn-block" onClick={() => window.print()}><Download size={18} /> Télécharger (PDF) ou imprimer</button>
          </div>
        )}
      </div>
      <p className="pay-footer muted small">Facture émise avec OmniCom Facturation</p>
    </div>
  );
}
