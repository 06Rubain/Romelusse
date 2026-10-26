import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRightLeft, Ban, Plus, Printer, Save, Trash2, Wallet } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { api, errorMessage } from '../lib/api';
import { useFeedback } from '../components/feedback';
import { useAuth } from '../auth/AuthContext';
import { convertAmount, formatDate, formatMoney, PRINT_SCALE, round2, toInputDate } from '../lib/format';
import { ZONE_LABELS, type Client, type Currency, type Invoice, type InvoiceTemplate, type Product, type ZoneKey } from '../lib/types';
import { Alert, Field, StatusBadge } from '../components/ui';
import InvoiceDocument from '../components/InvoiceDocument';
import TemplateDocument from '../components/TemplateDocument';
import { useFetch } from '../lib/useFetch';
import PaymentModal from '../components/PaymentModal';

interface EditLine { key: string; productId: string | null; name: string; quantity: number; unitPrice: number }

let lineSeq = 0;
const newKey = () => `l${++lineSeq}`;

export default function InvoiceGenerator() {
  const { confirm, prompt } = useFeedback();
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
  useEffect(() => { setInvoice(null); if (id) loadInvoice(); else resetForm(); }, [id]);

  useEffect(() => {
    if (id) return;
    api.get<{ nextNumber: string }>('/invoices/next-number', { type })
      .then((r) => setSuggestedNumber(r.nextNumber)).catch(() => setSuggestedNumber(''));
  }, [type, id]);

  function resetForm() {
    setType('Proforma'); setNumber(''); setClientName(''); setClientActivity(''); setIssueDate(toInputDate());
    setDueDate(''); setCurrency('USD'); setDiscount(''); setNotes(''); setLines([]);
  }

  const filteredCatalog = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return catalog.filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)).slice(0, 8);
  }, [catalog, productSearch]);

  const addProduct = (p: Product) => {
    const price = p.priceOnQuote ? 0 : round2(convertAmount(p.unitPrice, p.currency, currency, rate));
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p._id);
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { key: newKey(), productId: p._id, name: p.name, quantity: 1, unitPrice: price }];
    });
    setProductSearch('');
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
      } else {
        const created = await api.post<Invoice>('/invoices', body);
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
            <div className="form-grid">
              <div className="input-group">
                <span className="label">Type</span>
                <div className="segmented" role="radiogroup" aria-label="Type de document">
                  {(['Proforma', 'Facture'] as const).map((t) => (
                    <button key={t} type="button" role="radio" aria-checked={type === t} className={type === t ? 'active' : ''}
                      onClick={() => setType(t)} disabled={!!id && type !== t}>
                      {t === 'Proforma' ? 'Proforma (devis)' : 'Facture'}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Numéro" hint={id ? undefined : 'Laisser vide pour la numérotation automatique'}>
                <input className="input-field" value={number} onChange={(e) => setNumber(e.target.value)} placeholder={suggestedNumber} disabled={!!id} />
              </Field>
            </div>

            <Field label="Client">
              <input className="input-field" list="clients-list" value={clientName} onChange={(e) => pickClient(e.target.value)} placeholder="Choisir ou saisir un nouveau client" />
              <datalist id="clients-list">{clients.map((c) => <option key={c._id} value={c.name} />)}</datalist>
            </Field>
            <Field label="Activité / Réf. client (optionnel)">
              <input className="input-field" value={clientActivity} onChange={(e) => setClientActivity(e.target.value)} />
            </Field>

            <div className="form-grid">
              <Field label="Date">
                <input type="date" className="input-field" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </Field>
              {type === 'Facture' && (
                <Field label="Échéance" hint={settings ? `Par défaut : ${settings.paymentTermDays} jours` : undefined}>
                  <input type="date" className="input-field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </Field>
              )}
              <Field label="Devise">
                <select className="input-field" value={currency} onChange={(e) => changeCurrency(e.target.value as Currency)}>
                  <option value="USD">USD</option>
                  <option value="FC">Franc congolais (FC)</option>
                </select>
              </Field>
              <Field label="Taux (1 USD = ? FC)">
                <input type="number" min="0" className="input-field" value={rate} onChange={(e) => setRate(parseFloat(e.target.value) || 0)} />
              </Field>
            </div>

            <h3 className="section-title">Articles</h3>
            <div className="product-picker">
              <input className="input-field" placeholder="Rechercher un produit du catalogue…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
              {productSearch && (
                <div className="picker-results">
                  {filteredCatalog.map((p) => (
                    <button key={p._id} type="button" onClick={() => addProduct(p)}>
                      <span>{p.name}<small className="muted"> · {p.category}{p.trackStock ? ` · stock ${p.stockQuantity}` : ''}</small></span>
                      <strong>{p.priceOnQuote ? 'Sur devis' : formatMoney(p.unitPrice, p.currency)}</strong>
                    </button>
                  ))}
                  {filteredCatalog.length === 0 && <div className="muted" style={{ padding: 10 }}>Aucun produit trouvé.</div>}
                </div>
              )}
            </div>
            <div className="manual-line">
              <input className="input-field" placeholder="Article personnalisé" value={manualName} onChange={(e) => setManualName(e.target.value)} />
              <input className="input-field" placeholder={`Prix ${currency}`} inputMode="decimal" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} style={{ width: 110 }} />
              <button className="btn btn-outline" type="button" onClick={addManual} aria-label="Ajouter"><Plus size={16} /></button>
            </div>

            <div className="line-list">
              {lines.length > 0 && <div className="line-head muted small"><span>Désignation</span><span>Qté</span><span>P.U</span><span /></div>}
              {lines.map((l) => (
                <div key={l.key} className="line-row">
                  <input className="input-field" value={l.name} onChange={(e) => updateLine(l.key, { name: e.target.value })} />
                  <input className="input-field" type="number" min="0" step="any" value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: parseFloat(e.target.value) || 0 })} aria-label="Quantité" />
                  <input className="input-field" type="number" min="0" step="any" value={l.unitPrice} onChange={(e) => updateLine(l.key, { unitPrice: parseFloat(e.target.value) || 0 })} aria-label="Prix unitaire" />
                  <button className="icon-btn text-danger" onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} aria-label="Retirer"><Trash2 size={16} /></button>
                </div>
              ))}
              {lines.length === 0 && <div className="muted small">Aucun article. Recherchez un produit ou ajoutez un article personnalisé.</div>}
            </div>
            {lowStock.length > 0 && (
              <Alert tone="info">Stock insuffisant : {lowStock.map((l) => l.name).join(', ')}. La facture reste possible, le stock deviendra négatif.</Alert>
            )}

            <div className="form-grid">
              <Field label={`Remise (${currency})`}>
                <input className="input-field" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
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
            <Field label="Notes / conditions">
              <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>

            <div className="totals">
              <div><span>Sous-total</span><span>{formatMoney(subtotal, currency)}</span></div>
              {discountValue > 0 && <div><span>Remise</span><span>- {formatMoney(discountValue, currency)}</span></div>}
              <div className="strong"><span>Total</span><span>{formatMoney(total, currency)}</span></div>
            </div>

            <div className="stack-sm">
              <button className="btn btn-primary btn-block" onClick={save} disabled={busy}>
                <Save size={18} /> {busy ? 'Enregistrement…' : id ? 'Enregistrer les modifications' : `Enregistrer ${type === 'Proforma' ? 'la proforma' : 'la facture'}`}
              </button>
              {id && <button className="btn btn-outline btn-block" onClick={() => print()}><Printer size={18} /> Imprimer / PDF</button>}
              {invoice?.type === 'Proforma' && <button className="btn btn-outline btn-block" onClick={convert}><ArrowRightLeft size={18} /> Convertir en facture</button>}
              {invoice && can('invoices.cancel') && <button className="btn btn-ghost btn-block text-danger" onClick={cancel}><Ban size={18} /> Annuler la proforma</button>}
            </div>
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
              <button className="btn btn-primary btn-block" onClick={() => print()}><Printer size={18} /> Imprimer / PDF</button>
              {invoice.type === 'Facture' && invoice.balance > 0 && invoice.status !== 'Annulée' && can('payments.create') && (
                <button className="btn btn-outline btn-block" onClick={() => setPaying(true)}><Wallet size={18} /> Enregistrer un paiement</button>
              )}
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
