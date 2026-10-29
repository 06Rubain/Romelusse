import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRightLeft, Ban, Copy, ExternalLink, Link2, MessageCircle, Minus, Plus, Printer, Save, Trash2, Wallet } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { api, errorMessage } from '../lib/api';
import { useFeedback } from '../components/feedback';
import { useAuth } from '../auth/AuthContext';
import { convertAmount, formatDate, formatMoney, PRINT_SCALE, round2, toInputDate } from '../lib/format';
import { type Company, ZONE_LABELS, type Client, type Currency, type Invoice, type InvoiceTemplate, type Product, type ZoneKey } from '../lib/types';
import { Alert, Field, StatusBadge } from '../components/ui';
import InvoiceDocument from '../components/InvoiceDocument';
import TemplateDocument from '../components/TemplateDocument';
import { useFetch } from '../lib/useFetch';
import PaymentModal from '../components/PaymentModal';

interface EditLine { key: string; productId: string | null; name: string; quantity: number; unitPrice: number }

let lineSeq = 0;
const newKey = () => `l${++lineSeq}`;

// Message prêt à envoyer au client sur WhatsApp (numéro de sa fiche si renseigné)
// Page client de la facture : la voir et la payer sans compte
const clientPageUrl = (invoice: Invoice) => (invoice.publicToken ? `${window.location.origin}/p/${invoice.publicToken}` : '');

// Message prêt à envoyer au client sur WhatsApp (numéro de sa fiche si renseigné), avec le lien de sa page
const whatsappLink = (invoice: Invoice, company: Company | null, phone?: string) => {
  const companyName = company?.name || '';
  const open = invoice.status !== 'Payée' && invoice.status !== 'Annulée' && invoice.status !== 'Convertie';
  const due = invoice.type === 'Facture' && invoice.balance > 0 && open ? `\nReste à payer : ${formatMoney(invoice.balance, invoice.currency)}` : '';
  const page = clientPageUrl(invoice);
  const action = page
    ? `\n${open && company?.paymentLink ? 'Voir et payer en ligne (Mobile Money, carte)' : `Voir ${invoice.type === 'Proforma' ? 'la proforma' : 'la facture'}`} : ${page}`
    : '';
  const text = `Bonjour ${invoice.client},\nVoici votre ${invoice.type === 'Proforma' ? 'proforma' : 'facture'} ${invoice.number}`
    + `${companyName ? ` de ${companyName}` : ''}.\nMontant : ${formatMoney(invoice.totalAmount, invoice.currency)}${due}${action}`
    + '\nMerci pour votre confiance.';
  const digits = (phone || '').replace(/\D/g, '').replace(/^0+/, '');
  const number = digits && digits.length <= 9 ? `243${digits}` : digits;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
};

export default function InvoiceGenerator() {
  const { confirm, prompt, toast } = useFeedback();
  const { id } = useParams();
  const navigate = useNavigate();
  const { company: settings, can } = useAuth();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);

  // Formulaire
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [type, setType] = useState<'Proforma' | 'Facture'>(() => (searchParams.get('type') === 'Facture' ? 'Facture' : 'Proforma'));
  const [number, setNumber] = useState('');
  const [suggestedNumber, setSuggestedNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientActivity, setClientActivity] = useState('');
  const [issueDate, setIssueDate] = useState(toInputDate());
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [rate, setRate] = useState(settings?.exchangeRate || 2250);
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<EditLine[]>([]);
  const [printFormat, setPrintFormat] = useState<'A4' | 'A5' | 'A6'>('A4');
  // Modèle importé par l'entreprise (sinon modèle standard)
  const { data: template } = useFetch(() => api.get<InvoiceTemplate>('/company/template'), []);
  const customTemplate = template?.mode === 'custom' && template.background ? template : null;
  const [overflow, setOverflow] = useState<string[]>([]);

  const [productSearch, setProductSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  const contentRef = useRef<HTMLDivElement>(null);
  const print = useReactToPrint({ contentRef, documentTitle: number || 'facture' });

  const editable = !id || (invoice?.type === 'Proforma' && invoice.status === 'En attente');

  useEffect(() => {
    api.get<Product[]>('/products', { active: 'true' }).then(setCatalog).catch(() => setCatalog([]));
    api.get<Client[]>('/clients').then(setClients).catch(() => setClients([]));
  }, []);

  useEffect(() => { if (settings && !id) setRate(settings.exchangeRate); }, [settings, id]);

  const loadInvoice = async () => {
    if (!id) return;
    try {
      const data = await api.get<Invoice>(`/invoices/${id}`);
      setInvoice(data);
      setType(data.type);
      setNumber(data.number);
      setClientName(data.client);
      setClientActivity(data.clientActivity || '');
      setIssueDate(toInputDate(data.issueDate));
      setDueDate(data.dueDate ? toInputDate(data.dueDate) : '');
      setCurrency(data.currency);
      setRate(data.exchangeRate || settings?.exchangeRate || 2250);
      setDiscount(data.discount ? String(data.discount) : '');
      setNotes(data.notes || '');
      setLines(data.products.map((l) => ({ key: newKey(), productId: l.productId, name: l.name, quantity: l.quantity, unitPrice: l.unitPrice })));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setInvoice(null); if (id) loadInvoice(); else resetForm(); }, [id, location.key]);

  useEffect(() => {
    if (id) return;
    api.get<{ nextNumber: string }>('/invoices/next-number', { type })
      .then((r) => setSuggestedNumber(r.nextNumber)).catch(() => setSuggestedNumber(''));
  }, [type, id]);

  function resetForm() {
    const copy = (location.state as { copy?: Invoice } | null)?.copy;
    setType(copy?.type || (searchParams.get('type') === 'Facture' ? 'Facture' : 'Proforma'));
    setNumber(''); setClientName(copy?.client || ''); setClientActivity(copy?.clientActivity || ''); setIssueDate(toInputDate());
    setDueDate(''); setCurrency(copy?.currency || 'USD'); setDiscount(copy?.discount ? String(copy.discount) : ''); setNotes(copy?.notes || '');
    setLines(copy ? copy.products.map((l) => ({ key: newKey(), productId: l.productId, name: l.name, quantity: l.quantity, unitPrice: l.unitPrice })) : []);
  }

  const filteredCatalog = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return catalog.filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)).slice(0, 12);
  }, [catalog, productSearch]);

  const addProduct = (p: Product) => {
    const price = p.priceOnQuote ? 0 : round2(convertAmount(p.unitPrice, p.currency, currency, rate));
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p._id);
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { key: newKey(), productId: p._id, name: p.name, quantity: 1, unitPrice: price }];
    });
    setProductSearch('');
    setPickerOpen(false);
  };

  const addManual = () => {
    const price = parseFloat(manualPrice.replace(',', '.'));
    if (!manualName.trim() || !Number.isFinite(price)) {
      setError('Renseignez la désignation et le prix de l\'article personnalisé.');
      return;
    }
    setLines((prev) => [...prev, { key: newKey(), productId: null, name: manualName.trim(), quantity: 1, unitPrice: price }]);
    setManualName('');
    setManualPrice('');
    setError('');
  };

  const changeQuantity = (key: string, delta: number) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, round2(l.quantity + delta)) } : l)));

  const existingClient = clients.find((c) => c.name.toLowerCase() === clientName.trim().toLowerCase());
  const clientPhone = existingClient?.phone || clients.find((c) => c._id === invoice?.clientId)?.phone;
  const duplicate = () => invoice && navigate('/invoice', { state: { copy: invoice } });
  const shareButtons = invoice && (
    <>
      <a className="btn btn-whatsapp btn-block" href={whatsappLink(invoice, settings, clientPhone)} target="_blank" rel="noreferrer">
        <MessageCircle size={18} /> Envoyer par WhatsApp
      </a>
      {clientPageUrl(invoice) && (
        <div className="row-gap share-row">
          <button className="btn btn-outline btn-sm" onClick={async () => {
            try { await navigator.clipboard.writeText(clientPageUrl(invoice)); toast('Lien de la page client copié : collez-le dans un SMS ou un e-mail.'); } catch { toast(clientPageUrl(invoice), 'info'); }
          }}><Link2 size={15} /> Copier le lien client</button>
          <a className="btn btn-ghost btn-sm" href={clientPageUrl(invoice)} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Voir la page client</a>
        </div>
      )}
      {can('invoices.create') && <button className="btn btn-ghost btn-block" onClick={duplicate}><Copy size={18} /> Refaire un document identique</button>}
    </>
  );

  const updateLine = (key: string, patch: Partial<EditLine>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Changer de devise convertit les prix déjà saisis
  const changeCurrency = (next: Currency) => {
    setLines((prev) => prev.map((l) => ({ ...l, unitPrice: round2(convertAmount(l.unitPrice, currency, next, rate)) })));
    setDiscount((d) => (d ? String(round2(convertAmount(parseFloat(d) || 0, currency, next, rate))) : d));
    setCurrency(next);
  };

  const pickClient = (name: string) => {
    setClientName(name);
    const c = clients.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
    if (c && !clientActivity) setClientActivity(c.activity);
  };

  const discountValue = Math.max(0, parseFloat(discount.replace(',', '.')) || 0);
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const total = Math.max(0, subtotal - discountValue);
  const lowStock = lines.filter((l) => {
    const p = catalog.find((c) => c._id === l.productId);
    return type === 'Facture' && p?.trackStock && p.stockQuantity < l.quantity;
  });

  const save = async () => {
    if (!clientName.trim() || lines.length === 0) {
      setError('Veuillez renseigner le client et au moins un article.');
      return;
    }
    if (lines.some((l) => !(l.quantity > 0))) {
      setError('Chaque article doit avoir une quantité supérieure à zéro.');
      return;
    }
    const client = clients.find((c) => c.name.toLowerCase() === clientName.trim().toLowerCase());
    const body = {
      type, number: id ? undefined : number.trim() || undefined, clientId: client?._id, client: clientName.trim(), clientActivity,
      issueDate, dueDate: dueDate || undefined, currency, exchangeRate: rate, discount: discountValue, notes,
      products: lines.map(({ productId, name, quantity, unitPrice }) => ({ productId, name, quantity, unitPrice })),
    };
    setBusy(true);
    setError('');
    try {
      if (id) {
        await api.put(`/invoices/${id}`, body);
        await loadInvoice();
        toast('Modifications enregistrées.');
      } else {
        const created = await api.post<Invoice>('/invoices', body);
        toast(`${created.type} ${created.number} enregistrée. Vous pouvez l'imprimer ou l'envoyer.`);
        navigate(`/invoice/${created._id}`, { replace: true });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    if (!invoice || !(await confirm({ title: 'Convertir en facture ?', message: 'Une facture sera créée à partir de cette proforma et le stock sera mis à jour.', confirmLabel: 'Convertir' }))) return;
    try {
      const created = await api.post<Invoice>(`/invoices/${invoice._id}/convert`);
      navigate(`/invoice/${created._id}`);
    } catch (err) { setError(errorMessage(err)); }
  };

  const cancel = async () => {
    if (!invoice) return;
    const reason = await prompt({ title: 'Annuler la facture ?', message: 'Elle restera visible avec le cachet ANNULÉE et le stock sera rétabli.', label: 'Motif de l\'annulation', placeholder: 'Ex : erreur de saisie', confirmLabel: 'Annuler la facture', danger: true });
    if (reason === null) return;
    try { await api.post(`/invoices/${invoice._id}/cancel`, { reason }); await loadInvoice(); } catch (err) { setError(errorMessage(err)); }
  };

  const deletePayment = async (paymentId: string) => {
    if (!invoice || !(await confirm({ title: 'Supprimer cet encaissement ?', message: 'Le reste dû de la facture sera recalculé.', confirmLabel: 'Supprimer', danger: true }))) return;
    try { await api.del(`/invoices/${invoice._id}/payments/${paymentId}`); await loadInvoice(); } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <div className="editor-layout">
      <div className="editor-panel no-print">
        <Link to="/invoices" className="back-link"><ArrowLeft size={18} /> Factures</Link>

        {invoice ? (
          <div className="editor-title">
            <h2 style={{ margin: 0 }}>{invoice.type} {invoice.number}</h2>
            <StatusBadge status={invoice.status} />
          </div>
        ) : <h2>Nouveau document</h2>}

        <Alert>{error}</Alert>
        {customTemplate && overflow.length > 0 && (
          <Alert tone="info">Le modèle importé ne peut pas afficher tout le contenu ({overflow.map((k) => ZONE_LABELS[k as ZoneKey]).join(', ')}). Répartissez les articles sur deux documents ou agrandissez la zone dans « Modèle de facture ».</Alert>
        )}

        {editable ? (
          <>
            <div className="step-title"><span>1</span>Type et client</div>
            <div className="segmented segmented-lg" role="radiogroup" aria-label="Type de document">
              {(['Proforma', 'Facture'] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={type === t} className={type === t ? 'active' : ''}
                  onClick={() => setType(t)} disabled={!!id && type !== t}>
                  {t === 'Proforma' ? 'Proforma (devis)' : 'Facture'}
                </button>
              ))}
            </div>

            <Field label="Client" hint={clientName.trim() && !existingClient ? 'Nouveau client : sa fiche sera créée automatiquement.' : undefined}>
              <input className="input-field" list="clients-list" value={clientName} onChange={(e) => pickClient(e.target.value)} placeholder="Nom du client" autoFocus={!id} />
              <datalist id="clients-list">{clients.map((c) => <option key={c._id} value={c.name} />)}</datalist>
            </Field>

            <div className="form-grid">
              <Field label="Date">
                <input type="date" className="input-field" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </Field>
              {type === 'Facture' ? (
                <Field label="À payer avant le" hint={settings ? `Vide = ${settings.paymentTermDays} jours` : undefined}>
                  <input type="date" className="input-field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </Field>
              ) : (
                <div className="input-group">
                  <span className="label">Devise</span>
                  <CurrencySwitch value={currency} onChange={changeCurrency} />
                </div>
              )}
            </div>
            {type === 'Facture' && (
              <div className="input-group">
                <span className="label">Devise</span>
                <CurrencySwitch value={currency} onChange={changeCurrency} />
              </div>
            )}

            <div className="step-title"><span>2</span>Articles</div>
            <div className="product-picker">
              <input className="input-field" placeholder={catalog.length ? 'Touchez ici pour choisir dans le catalogue…' : 'Rechercher un produit…'} value={productSearch}
                onChange={(e) => { setProductSearch(e.target.value); setPickerOpen(true); }}
                onFocus={() => setPickerOpen(true)} onBlur={() => setPickerOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredCatalog[0]) { e.preventDefault(); addProduct(filteredCatalog[0]); }
                  if (e.key === 'Escape') setPickerOpen(false);
                }} />
              {pickerOpen && (productSearch || catalog.length > 0) && (
                <div className="picker-results">
                  {filteredCatalog.map((p) => (
                    <button key={p._id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addProduct(p)}>
                      <span>{p.name}<small className="muted"> · {p.category}{p.trackStock ? ` · stock ${p.stockQuantity}` : ''}</small></span>
                      <strong>{p.priceOnQuote ? 'Sur devis' : formatMoney(p.unitPrice, p.currency)}</strong>
                    </button>
                  ))}
                  {filteredCatalog.length === 0 && <div className="muted" style={{ padding: 10 }}>Aucun produit trouvé : ajoutez-le comme article libre ci-dessous.</div>}
                </div>
              )}
            </div>
            <form className="manual-line" onSubmit={(e) => { e.preventDefault(); addManual(); }}>
              <input className="input-field" placeholder="Ou un article libre" value={manualName} onChange={(e) => setManualName(e.target.value)} />
              <input className="input-field" placeholder={`Prix ${currency}`} inputMode="decimal" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} style={{ width: 110 }} />
              <button className="btn btn-outline" type="submit" aria-label="Ajouter"><Plus size={16} /></button>
            </form>

            <div className="line-list">
              {lines.map((l) => (
                <div key={l.key} className="line-card">
                  <div className="line-card-top">
                    <input className="input-field" value={l.name} onChange={(e) => updateLine(l.key, { name: e.target.value })} aria-label="Désignation" />
                    <button className="icon-btn text-danger" onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} aria-label="Retirer"><Trash2 size={16} /></button>
                  </div>
                  <div className="line-card-bottom">
                    <div className="stepper">
                      <button type="button" onClick={() => changeQuantity(l.key, -1)} disabled={l.quantity <= 1} aria-label="Diminuer"><Minus size={14} /></button>
                      <input type="number" min="0" step="any" value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: parseFloat(e.target.value) || 0 })} aria-label="Quantité" />
                      <button type="button" onClick={() => changeQuantity(l.key, 1)} aria-label="Augmenter"><Plus size={14} /></button>
                    </div>
                    <span className="muted small">×</span>
                    <input className="input-field price" type="number" min="0" step="any" value={l.unitPrice} onChange={(e) => updateLine(l.key, { unitPrice: parseFloat(e.target.value) || 0 })} aria-label="Prix unitaire" />
                    <strong className="line-total">{formatMoney(l.quantity * l.unitPrice, currency)}</strong>
                  </div>
                </div>
              ))}
              {lines.length === 0 && <div className="line-empty">Aucun article pour l'instant. Choisissez un produit du catalogue ou tapez un article libre avec son prix.</div>}
            </div>
            {lowStock.length > 0 && (
              <Alert tone="info">Stock insuffisant : {lowStock.map((l) => l.name).join(', ')}. La facture reste possible, le stock deviendra négatif.</Alert>
            )}

            <div className="step-title"><span>3</span>Vérifier et enregistrer</div>
            <details className="more-options">
              <summary>Plus d'options : remise, notes, numéro, taux, format</summary>
              <div className="form-grid">
                <Field label={`Remise (${currency})`}>
                  <input className="input-field" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
                </Field>
                <Field label="Numéro" hint={id ? undefined : 'Vide = automatique'}>
                  <input className="input-field" value={number} onChange={(e) => setNumber(e.target.value)} placeholder={suggestedNumber} disabled={!!id} />
                </Field>
                <Field label="Taux (1 USD = ? FC)">
                  <input type="number" min="0" className="input-field" value={rate} onChange={(e) => setRate(parseFloat(e.target.value) || 0)} />
                </Field>
                {customTemplate ? (
                  <Field label="Modèle"><div className="muted small" style={{ paddingTop: 10 }}>Votre modèle importé ({customTemplate.pageSize})</div></Field>
                ) : (
                  <Field label="Format d'impression">
                    <select className="input-field" value={printFormat} onChange={(e) => setPrintFormat(e.target.value as 'A4' | 'A5' | 'A6')}>
                      <option value="A4">A4 (standard)</option>
                      <option value="A5">A5 (moyen)</option>
                      <option value="A6">A6 (petit)</option>
                    </select>
                  </Field>
                )}
              </div>
              <Field label="Activité / Réf. client">
                <input className="input-field" value={clientActivity} onChange={(e) => setClientActivity(e.target.value)} />
              </Field>
              <Field label="Notes / conditions">
                <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </details>

            <div className="save-bar">
              <div className="totals">
                {discountValue > 0 && <div><span>Sous-total</span><span>{formatMoney(subtotal, currency)}</span></div>}
                {discountValue > 0 && <div><span>Remise</span><span>- {formatMoney(discountValue, currency)}</span></div>}
                <div className="strong"><span>Total</span><span>{formatMoney(total, currency)}</span></div>
              </div>
              <button className="btn btn-primary btn-block btn-lg" onClick={save} disabled={busy}>
                <Save size={18} /> {busy ? 'Enregistrement…' : id ? 'Enregistrer les modifications' : `Enregistrer ${type === 'Proforma' ? 'la proforma' : 'la facture'}`}
              </button>
            </div>
            {id && (
              <div className="stack-sm" style={{ marginTop: 10 }}>
                <button className="btn btn-outline btn-block" onClick={() => print()}><Printer size={18} /> Imprimer / PDF</button>
                {shareButtons}
                {invoice?.type === 'Proforma' && <button className="btn btn-outline btn-block" onClick={convert}><ArrowRightLeft size={18} /> Le client accepte : convertir en facture</button>}
                {invoice && can('invoices.cancel') && <button className="btn btn-ghost btn-block text-danger" onClick={cancel}><Ban size={18} /> Annuler la proforma</button>}
              </div>
            )}
          </>
        ) : invoice && (
          <>
            <div className="info-list">
              <div><span>Client</span><strong>{invoice.client}</strong></div>
              <div><span>Date</span><strong>{formatDate(invoice.issueDate)}</strong></div>
              {invoice.type === 'Facture' && <div><span>Échéance</span><strong>{formatDate(invoice.dueDate)}</strong></div>}
              <div><span>Total</span><strong>{formatMoney(invoice.totalAmount, invoice.currency)}</strong></div>
              {invoice.type === 'Facture' && <div><span>Payé</span><strong className="text-success">{formatMoney(invoice.amountPaid, invoice.currency)}</strong></div>}
              {invoice.type === 'Facture' && invoice.status !== 'Annulée' && <div><span>Reste dû</span><strong className={invoice.balance > 0 ? 'text-danger' : ''}>{formatMoney(invoice.balance, invoice.currency)}</strong></div>}
              <div><span>Créée par</span><strong>{invoice.createdBy || '—'}</strong></div>
            </div>
            {invoice.convertedTo && <Alert tone="info">Convertie en facture : <Link to={`/invoice/${invoice.convertedTo}`}>voir la facture</Link></Alert>}
            {invoice.sourceProforma && <p className="muted small">Issue de la <Link to={`/invoice/${invoice.sourceProforma}`}>proforma d'origine</Link>.</p>}

            {!customTemplate && (
            <Field label="Format d'impression">
              <select className="input-field" value={printFormat} onChange={(e) => setPrintFormat(e.target.value as 'A4' | 'A5' | 'A6')}>
                <option value="A4">A4 (standard)</option>
                <option value="A5">A5 (moyen)</option>
                <option value="A6">A6 (petit)</option>
              </select>
            </Field>
            )}
            <div className="stack-sm">
              {invoice.type === 'Facture' && invoice.balance > 0 && invoice.status !== 'Annulée' && can('payments.create') && (
                <button className="btn btn-primary btn-block btn-lg" onClick={() => setPaying(true)}><Wallet size={18} /> Le client a payé : encaisser</button>
              )}
              <button className={`btn btn-block ${invoice.type === 'Facture' && invoice.balance > 0 && invoice.status !== 'Annulée' ? 'btn-outline' : 'btn-primary btn-lg'}`} onClick={() => print()}><Printer size={18} /> Imprimer / PDF</button>
              {shareButtons}
              {can('invoices.cancel') && invoice.status !== 'Annulée' && invoice.status !== 'Convertie' && invoice.amountPaid === 0 && (
                <button className="btn btn-ghost btn-block text-danger" onClick={cancel}><Ban size={18} /> Annuler la facture</button>
              )}
            </div>

            {invoice.type === 'Facture' && (
              <>
                <h3 className="section-title">Encaissements</h3>
                <ul className="list">
                  {invoice.payments?.map((p) => (
                    <li key={p._id}>
                      <span>{formatDate(p.date)} · {p.method}{p.reference ? ` · ${p.reference}` : ''}</span>
                      <span className="row-gap">
                        <strong>{formatMoney(p.amount, p.currency)}</strong>
                        {can('payments.delete') && <button className="icon-btn text-danger" onClick={() => deletePayment(p._id)} aria-label="Supprimer"><Trash2 size={15} /></button>}
                      </span>
                    </li>
                  ))}
                  {invoice.payments?.length === 0 && <li className="muted">Aucun encaissement.</li>}
                </ul>
              </>
            )}
            {invoice.notes && <><h3 className="section-title">Notes</h3><p className="muted" style={{ whiteSpace: 'pre-line' }}>{invoice.notes}</p></>}
          </>
        )}
      </div>

      <div className="editor-preview">
        <div className="preview-fit">
        {customTemplate ? (
          <TemplateDocument
            ref={contentRef}
            template={customTemplate}
            company={settings}
            onOverflowChange={setOverflow}
            data={{
              type, number: number || suggestedNumber, client: clientName, clientActivity, issueDate, dueDate, currency, lines,
              discount: discountValue, paid: invoice?.status === 'Payée', cancelled: invoice?.status === 'Annulée', notes,
            }}
          />
        ) : (
        <InvoiceDocument
          ref={contentRef}
          type={type}
          number={number || suggestedNumber}
          client={clientName}
          clientActivity={clientActivity}
          issueDate={issueDate}
          dueDate={dueDate}
          currency={currency}
          lines={lines}
          discount={discountValue}
          paid={invoice?.status === 'Payée'}
          cancelled={invoice?.status === 'Annulée'}
          notes={notes}
          company={settings}
          printFormat={printFormat}
        />
        )}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: ${customTemplate ? customTemplate.pageSize : printFormat}; margin: 0; }
          #print-area { box-shadow: none !important; transform: ${customTemplate || PRINT_SCALE[printFormat] === 1 ? 'none' : `scale(${PRINT_SCALE[printFormat]})`} !important; transform-origin: top left !important; }
        }
      `}</style>

      {paying && invoice && <PaymentModal invoice={invoice} onClose={() => setPaying(false)} onSaved={loadInvoice} />}
    </div>
  );
}

function CurrencySwitch({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Devise">
      {(['USD', 'FC'] as const).map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} className={value === c ? 'active' : ''} onClick={() => onChange(c)}>
          {c === 'USD' ? 'Dollar ($)' : 'Franc (FC)'}
        </button>
      ))}
    </div>
  );
}
