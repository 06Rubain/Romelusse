import { useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, CheckCircle2, Copy, CreditCard, Download, ExternalLink, FileText, Phone, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { formatDate, formatMoney } from '../lib/format';
import { logoBackground } from '../lib/brand';
import type { Company, Currency, InvoiceStatus, InvoiceTemplate } from '../lib/types';
import InvoiceDocument from '../components/InvoiceDocument';
import TemplateDocument from '../components/TemplateDocument';

interface PublicData {
  invoice: {
    number: string; type: 'Proforma' | 'Facture'; client: string; clientActivity: string; issueDate: string; dueDate: string | null;
    currency: Currency; products: { name: string; quantity: number; unitPrice: number }[]; subtotal: number; discount: number;
    totalAmount: number; amountPaid: number; balance: number; status: InvoiceStatus; notes: string;
  };
  company: Company;
  template: InvoiceTemplate | null;
}

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

// Page ouverte par le client depuis le lien reçu : voir sa facture et la payer, sans compte
export default function PublicInvoice() {
  const { token = '' } = useParams();
  const { data, error, loading } = useFetch(() => api.get<PublicData>(`/public/invoices/${token}`), [token]);
  const [showDoc, setShowDoc] = useState(false);
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
  const isProforma = invoice.type === 'Proforma';
  const paid = invoice.status === 'Payée';
  const cancelled = invoice.status === 'Annulée';
  const converted = invoice.status === 'Convertie';
  const due = isProforma ? invoice.totalAmount : invoice.balance;
  const payable = !paid && !cancelled && !converted && due > 0;
  const amount = formatMoney(due, invoice.currency);
  const lines = invoice.products.map((p) => ({ name: p.name, quantity: p.quantity, unitPrice: p.unitPrice }));
  const firstPhone = (company.phone || '').split(/[/,;]/)[0].replace(/[^\d+]/g, '');

  return (
    <div className="pay-page">
      <div className="pay-card">
        <header className="pay-head">
          {company.logo
            ? <img src={company.logo} alt="" className="pay-logo" style={logoBackground(company)} />
            : <span className="pay-logo placeholder">{company.name.charAt(0).toUpperCase()}</span>}
          <div>
            <div className="strong">{company.name}</div>
            <div className="muted small">{[company.city, company.phone].filter(Boolean).join(' · ')}</div>
          </div>
        </header>

        <div className="pay-doc-title">
          <span className="muted small">{isProforma ? 'Proforma (devis)' : 'Facture'} {invoice.number}</span>
          <span className="muted small">{formatDate(invoice.issueDate)}</span>
        </div>
        <p className="pay-hello">Bonjour <strong>{invoice.client}</strong>,</p>

        {paid && <div className="pay-status success"><CheckCircle2 size={22} /><div><strong>Facture réglée</strong><div>Merci pour votre paiement de {formatMoney(invoice.totalAmount, invoice.currency)}.</div></div></div>}
        {cancelled && <div className="pay-status danger"><XCircle size={22} /><div><strong>Facture annulée</strong><div>Aucun paiement n'est demandé.</div></div></div>}
        {converted && <div className="pay-status info"><FileText size={22} /><div><strong>Proforma acceptée</strong><div>Elle a été transformée en facture : demandez le nouveau lien à {company.name}.</div></div></div>}

        {payable && (
          <>
            <div className="pay-amount">
              <span className="muted">{isProforma ? 'Montant du devis' : 'Montant à payer'}</span>
              <strong>{amount}</strong>
              {!isProforma && invoice.amountPaid > 0 && <span className="muted small">Déjà payé : {formatMoney(invoice.amountPaid, invoice.currency)} sur {formatMoney(invoice.totalAmount, invoice.currency)}</span>}
              {!isProforma && invoice.dueDate && <span className="muted small">À payer avant le {formatDate(invoice.dueDate)}</span>}
            </div>

            {company.paymentLink ? (
              <div className="pay-online">
                <a className="btn btn-primary btn-block btn-lg pay-button" href={company.paymentLink} target="_blank" rel="noreferrer">
                  <CreditCard size={20} /> Payer maintenant <ExternalLink size={16} />
                </a>
                {company.paymentMethods?.length > 0 && (
                  <div className="pay-methods">{company.paymentMethods.map((m) => <span key={m}>{m}</span>)}</div>
                )}
                <ol className="pay-steps">
                  <li>Appuyez sur <strong>Payer maintenant</strong> : la page de paiement sécurisée s'ouvre.</li>
                  <li>Choisissez votre moyen : Mobile Money ou carte bancaire.</li>
                  <li>Saisissez le montant <strong>{amount}</strong> et la référence <strong>{invoice.number}</strong>.</li>
                </ol>
                <div className="row-gap pay-copy">
                  <CopyButton value={invoice.number} label="Copier la référence" />
                  <CopyButton value={String(due)} label="Copier le montant" />
                </div>
              </div>
            ) : (company.bankName || company.bankAccount) && (
              <div className="pay-bank">
                <strong>Paiement par virement</strong>
                <div>{company.bankName} : {company.bankAccount}</div>
                {company.legalName && <div className="muted small">Au nom de {company.legalName} · référence {invoice.number}</div>}
              </div>
            )}
          </>
        )}

        <div className="pay-actions">
          <button type="button" className="btn btn-outline btn-block" onClick={() => setShowDoc((v) => !v)}>
            <FileText size={18} /> {showDoc ? 'Masquer la facture' : `Voir ${isProforma ? 'la proforma' : 'la facture'}`}
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
