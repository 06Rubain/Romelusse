import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Ban, Minus, Plus, Printer, Save, Trash2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useFeedback } from '../components/feedback';
import { formatDate, toInputDate } from '../lib/format';
import type { DeliveryLine, DeliveryNote } from '../lib/types';
import { Alert, Field, PageLoader } from '../components/ui';
import DeliveryDocument from '../components/DeliveryDocument';

interface Prepared {
  invoice: { _id: string; number: string; type: string; client: string; clientActivity: string; status: string };
  lines: { source: number; name: string; ordered: number; already: number; remaining: number }[];
  previousDeliveries: number;
  nextNumber: string;
}

interface EditLine { source: number | null; name: string; ordered: number; already: number; remaining: number; delivered: number }

// Bon de livraison : création (depuis une facture, un bon de commande, ou libre) et consultation / impression
export default function DeliveryNotePage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('invoice');
  const navigate = useNavigate();
  const { company, can } = useAuth();
  const { prompt, toast } = useFeedback();
  const contentRef = useRef<HTMLDivElement>(null);

  const [note, setNote] = useState<DeliveryNote | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [nextNumber, setNextNumber] = useState('');
  const [client, setClient] = useState('');
  const [date, setDate] = useState(toInputDate(new Date()));
  const [address, setAddress] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<EditLine[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const print = useReactToPrint({ contentRef, documentTitle: note?.number || 'bon-de-livraison' });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const load = async () => {
      try {
        if (id) {
          const data = await api.get<DeliveryNote>(`/deliveries/${id}`);
          if (alive) setNote(data);
        } else if (invoiceId) {
          const data = await api.get<Prepared>(`/deliveries/prepare/${invoiceId}`);
          if (!alive) return;
          setPrepared(data);
          setNextNumber(data.nextNumber);
          setClient(data.invoice.client);
          setLines(data.lines.map((l) => ({ ...l, delivered: l.remaining })));
        } else {
          const data = await api.get<{ nextNumber: string }>('/deliveries/next-number');
          if (!alive) return;
          setNextNumber(data.nextNumber);
          setLines([{ source: null, name: '', ordered: 1, already: 0, remaining: Infinity, delivered: 1 }]);
        }
      } catch (err) {
        if (alive) setError(errorMessage(err));
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [id, invoiceId]);

  const free = !id && !invoiceId;
  const setLine = (i: number, patch: Partial<EditLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const nothingLeft = !!prepared && prepared.lines.every((l) => l.remaining <= 0);

  const docLines: DeliveryLine[] = useMemo(() => (note
    ? note.lines
    : lines.filter((l) => l.name.trim() && l.delivered > 0).map((l) => ({ name: l.name, ordered: l.ordered, delivered: l.delivered }))), [note, lines]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const body = prepared
        ? { invoiceId: prepared.invoice._id, date, deliveryAddress: address, deliveredBy, receivedBy, notes, lines: lines.map((l) => ({ source: l.source, delivered: l.delivered })) }
        : { client, date, deliveryAddress: address, deliveredBy, receivedBy, notes, lines: lines.map((l) => ({ name: l.name, ordered: l.ordered, delivered: l.delivered })) };
      const created = await api.post<DeliveryNote>('/deliveries', body);
      toast(`Bon de livraison ${created.number} enregistré.`);
      navigate(`/delivery/${created._id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!note) return;
    const reason = await prompt({ title: 'Annuler ce bon de livraison ?', message: 'Il restera visible avec la mention ANNULÉ, et les quantités redeviendront à livrer.', label: 'Motif', placeholder: 'Ex : erreur de quantité', confirmLabel: 'Annuler le bon', danger: true });
    if (reason === null) return;
    try { setNote(await api.post<DeliveryNote>(`/deliveries/${note._id}/cancel`, { reason })); } catch (err) { setError(errorMessage(err)); }
  };

  if (loading) return <PageLoader />;

  const back = note?.invoice ? `/invoice/${note.invoice}` : prepared ? `/invoice/${prepared.invoice._id}` : '/deliveries';

  return (
    <div className="editor-layout">
      <div className="editor-panel no-print">
        <Link to={back} className="back-link"><ArrowLeft size={18} /> {note?.invoice || prepared ? 'Document d\'origine' : 'Bons de livraison'}</Link>
        <div className="editor-title">
          <h2 style={{ margin: 0 }}>{note ? `Bon de livraison ${note.number}` : 'Nouveau bon de livraison'}</h2>
          {note && <span className={`badge ${note.status === 'Annulé' ? 'badge-danger' : 'badge-success'}`}>{note.status}</span>}
        </div>
        <Alert>{error}</Alert>

        {note ? (
          <>
            <div className="info-list">
              <div><span>Client</span><strong>{note.client}</strong></div>
              <div><span>Date</span><strong>{formatDate(note.date)}</strong></div>
              {note.invoiceNumber && <div><span>Document d'origine</span><strong><Link to={`/invoice/${note.invoice}`}>{note.invoiceNumber}</Link></strong></div>}
              <div><span>Articles livrés</span><strong>{note.lines.reduce((s, l) => s + l.delivered, 0).toLocaleString('fr-FR')}</strong></div>
              <div><span>Créé par</span><strong>{note.createdBy}</strong></div>
            </div>
            <div className="stack-sm" style={{ marginTop: 16 }}>
              <button className="btn btn-primary btn-block btn-lg" onClick={() => print()}><Printer size={18} /> Imprimer / PDF</button>
              {note.status !== 'Annulé' && can('invoices.cancel') && (
                <button className="btn btn-ghost btn-block text-danger" onClick={cancel}><Ban size={18} /> Annuler le bon de livraison</button>
              )}
            </div>
          </>
        ) : (
          <>
            {prepared && (
              <p className="muted small">
                Depuis {prepared.invoice.type === 'Facture' ? 'la facture' : 'le bon de commande'} <strong>{prepared.invoice.number}</strong>
                {prepared.previousDeliveries > 0 && ` · ${prepared.previousDeliveries} livraison(s) déjà faite(s)`}.
              </p>
            )}
            {nothingLeft && <Alert tone="info">Tout a déjà été livré pour ce document.</Alert>}
            <Field label="Client">
              <input className="input-field" value={client} onChange={(e) => setClient(e.target.value)} disabled={!!prepared} placeholder="Nom du client" />
            </Field>
            <div className="form-grid">
              <Field label="Date de livraison"><input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Numéro"><input className="input-field" value={nextNumber} disabled /></Field>
            </div>

            <h3 className="section-title">Articles</h3>
            <div className="line-list">
              {lines.map((l, i) => (
                <div key={i} className="line-card">
                  <div className="line-card-top">
                    {free
                      ? <input className="input-field" value={l.name} placeholder="Désignation" onChange={(e) => setLine(i, { name: e.target.value })} />
                      : <strong style={{ flex: 1 }}>{l.name}</strong>}
                    {free && lines.length > 1 && <button type="button" className="icon-btn text-danger" aria-label="Retirer" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 size={16} /></button>}
                  </div>
                  <div className="line-card-bottom">
                    {free ? (
                      <label className="muted small">Commandé <input type="number" min="0" className="input-field price" value={l.ordered} onChange={(e) => setLine(i, { ordered: Math.max(0, Number(e.target.value) || 0) })} /></label>
                    ) : (
                      <span className="muted small">Commandé {l.ordered}{l.already > 0 ? ` · déjà livré ${l.already}` : ''} · reste {l.remaining}</span>
                    )}
                    <div className="stepper" style={{ marginLeft: 'auto' }}>
                      <button type="button" aria-label="Moins" onClick={() => setLine(i, { delivered: Math.max(0, l.delivered - 1) })}><Minus size={14} /></button>
                      <input type="number" min="0" value={l.delivered} aria-label={`Livré : ${l.name}`}
                        onChange={(e) => setLine(i, { delivered: Math.max(0, Math.min(l.remaining, Number(e.target.value) || 0)) })} />
                      <button type="button" aria-label="Plus" onClick={() => setLine(i, { delivered: Math.min(l.remaining, l.delivered + 1) })}><Plus size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {free && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setLines((ls) => [...ls, { source: null, name: '', ordered: 1, already: 0, remaining: Infinity, delivered: 1 }])}>
                <Plus size={16} /> Ajouter un article
              </button>
            )}

            <h3 className="section-title">Livraison</h3>
            <Field label="Lieu de livraison (facultatif)"><input className="input-field" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ex : Hôtel du Fleuve, Gombe" /></Field>
            <div className="form-grid">
              <Field label="Livré par"><input className="input-field" value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value)} placeholder="Nom du livreur" /></Field>
              <Field label="Reçu par"><input className="input-field" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Nom de la personne" /></Field>
            </div>
            <Field label="Remarques (facultatif)"><textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

            <div className="save-bar">
              <button className="btn btn-primary btn-block btn-lg" onClick={save} disabled={busy || nothingLeft || !docLines.length || (free && !client.trim())}>
                <Save size={18} /> {busy ? 'Enregistrement…' : 'Enregistrer le bon de livraison'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="editor-preview">
        <div className="preview-fit">
          <DeliveryDocument
            ref={contentRef}
            number={note?.number || nextNumber}
            client={note?.client || client}
            clientActivity={note?.clientActivity || prepared?.invoice.clientActivity}
            date={note?.date || date}
            invoiceNumber={note?.invoiceNumber || prepared?.invoice.number}
            deliveryAddress={note?.deliveryAddress ?? address}
            lines={docLines}
            deliveredBy={note?.deliveredBy ?? deliveredBy}
            receivedBy={note?.receivedBy ?? receivedBy}
            notes={note?.notes ?? notes}
            cancelled={note?.status === 'Annulé'}
            company={company}
          />
        </div>
      </div>
    </div>
  );
}

