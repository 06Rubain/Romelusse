import { forwardRef, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { numberToFrenchWords } from '../utils/numberToWords';
import { formatDate, PAGE_MM } from '../lib/format';
import { ZONE_LABELS, type Company, type Currency, type InvoiceTemplate, type Zone, type ZoneKey } from '../lib/types';
import PaymentBlock from './PaymentBlock';
import type { DocumentLine } from './InvoiceDocument';

const PT_TO_MM = 0.3528;

export interface DocumentData {
  type: 'Proforma' | 'Facture';
  number: string;
  client: string;
  clientActivity: string;
  issueDate: string;
  dueDate?: string | null;
  currency: Currency;
  lines: DocumentLine[];
  discount: number;
  paid: boolean;
  cancelled: boolean;
  notes?: string;
}

interface Props {
  template: InvoiceTemplate;
  data: DocumentData;
  // Mode édition : zones déplaçables et redimensionnables
  editable?: boolean;
  selected?: ZoneKey | null;
  onSelect?: (key: ZoneKey) => void;
  onZoneChange?: (key: ZoneKey, zone: Zone) => void;
  // Signale les zones dont le contenu ne tient pas, même à la plus petite taille
  onOverflowChange?: (zones: ZoneKey[]) => void;
  // Signature et paiement en ligne de l'entreprise
  company?: Company | null;
}

// Réduit la taille du texte jusqu'à ce que le contenu tienne dans sa zone
function FitBox({ base, min = 4.5, deps, onOverflow, children }: {
  base: number; min?: number; deps: string; onOverflow?: (overflowing: boolean) => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(base);
  useLayoutEffect(() => { setSize(base); }, [base, deps]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const overflowing = el.scrollHeight > el.clientHeight + 1;
    if (overflowing && size > min) setSize((s) => Math.max(min, +(s - 0.5).toFixed(1)));
    else onOverflow?.(overflowing);
  }, [size, min, onOverflow]);
  return <div ref={ref} style={{ height: '100%', overflow: 'hidden', fontSize: `${size}pt` }}>{children}</div>;
}

const money = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Facture rendue sur le modèle importé par l'entreprise
const TemplateDocument = forwardRef<HTMLDivElement, Props>(function TemplateDocument(
  { template, data, editable, selected, onSelect, onZoneChange, onOverflowChange, company }, ref,
) {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const overflowRef = useRef<Set<ZoneKey>>(new Set());
  const reporters = useRef<Partial<Record<ZoneKey, (o: boolean) => void>>>({});
  const reportOverflow = (key: ZoneKey) => {
    reporters.current[key] ??= (overflowing: boolean) => {
      const set = overflowRef.current;
      if (overflowing === set.has(key)) return;
      if (overflowing) set.add(key); else set.delete(key);
      onOverflowChange?.([...set]);
    };
    return reporters.current[key];
  };
  const { zones, style, labels } = template;
  const page = PAGE_MM[template.pageSize];
  const subtotal = data.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const total = Math.max(0, subtotal - data.discount);
  const integer = Math.floor(total);
  const cents = Math.round((total - integer) * 100);
  const border = style.showBorders ? `1px solid ${style.borderColor}` : 'none';

  // Le tableau réduit sa police pour que toutes les lignes tiennent dans sa zone
  const itemsHeightMm = (zones.items.h / 100) * page.h;
  const rowsNeeded = Math.max(1, data.lines.length) + 1.3;
  const fitted = itemsHeightMm / (rowsNeeded * 1.75 * PT_TO_MM);
  const itemsFont = Math.max(5.5, Math.min(style.fontSize, fitted));

  const startDrag = (key: ZoneKey, mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    if (!editable || !pageRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(key);
    const rect = pageRef.current.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, zone: { ...zones[key] } };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - start.x) / rect.width) * 100;
      const dy = ((ev.clientY - start.y) / rect.height) * 100;
      const z = { ...start.zone };
      if (mode === 'move') {
        z.x = Math.min(100 - z.w, Math.max(0, start.zone.x + dx));
        z.y = Math.min(100 - z.h, Math.max(0, start.zone.y + dy));
      } else {
        z.w = Math.min(100 - z.x, Math.max(3, start.zone.w + dx));
        z.h = Math.min(100 - z.y, Math.max(2, start.zone.h + dy));
      }
      onZoneChange?.(key, { ...z, x: +z.x.toFixed(2), y: +z.y.toFixed(2), w: +z.w.toFixed(2), h: +z.h.toFixed(2) });
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };

  // Toute modification du contenu ou de la zone relance l'ajustement
  const contentKey = JSON.stringify([data, labels, style.fontFamily, template.pageSize]);

  const zone = (key: ZoneKey, children: ReactNode, extra: CSSProperties = {}) => {
    const z = zones[key];
    if (!z.visible) return null;
    const base = key === 'items' ? itemsFont : style.fontSize;
    const content = key === 'stamp' || key === 'signature' || key === 'payment' ? children : (
      <FitBox base={base} deps={`${contentKey}|${z.w}|${z.h}`} onOverflow={reportOverflow(key)}>{children}</FitBox>
    );
    return (
      <div
        key={key}
        className={editable ? `tpl-zone ${selected === key ? 'selected' : ''}` : undefined}
        onPointerDown={editable ? startDrag(key, 'move') : undefined}
        style={{
          position: 'absolute', left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%`,
          textAlign: z.align, overflow: 'hidden', boxSizing: 'border-box', ...extra,
        }}
      >
        {content}
        {editable && (
          <>
            <span className="tpl-zone-label">{ZONE_LABELS[key]}</span>
            <span className="tpl-zone-handle" onPointerDown={startDrag(key, 'resize')} />
          </>
        )}
      </div>
    );
  };

  // Marges proportionnelles à la police : elles se resserrent avec le texte
  const cell: CSSProperties = { padding: '0.15em 0.45em', border };
  const head: CSSProperties = { ...cell, background: style.headerBg, color: style.headerText, fontWeight: 700 };

  return (
    <div ref={ref} id="print-area" className="tpl-doc" style={{
      width: `${page.w}mm`, height: `${page.h}mm`, position: 'relative', margin: '0 auto', background: '#fff',
      color: style.textColor, fontFamily: style.fontFamily, fontSize: `${style.fontSize}pt`, lineHeight: 1.3,
      boxShadow: '0 10px 30px rgba(0,0,0,0.1)', overflow: 'hidden',
    }}>
      <div ref={pageRef} style={{ position: 'absolute', inset: 0 }}>
        {template.background && <img src={template.background} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} />}

        {zone('meta', (
          <>
            <div style={{ fontWeight: 800, fontSize: '1.15em' }}>{data.type === 'Proforma' ? labels.proforma : labels.facture} {data.number}</div>
            <div>{labels.date} : <b>{formatDate(data.issueDate)}</b></div>
            {data.type === 'Facture' && data.dueDate && <div>{labels.dueDate} : <b>{formatDate(data.dueDate)}</b></div>}
          </>
        ))}

        {zone('client', (
          <>
            <div>{labels.client} : <b style={{ fontSize: '1.1em' }}>{data.client.toUpperCase() || '—'}</b></div>
            {data.clientActivity && <div>{data.clientActivity}</div>}
          </>
        ))}

        {zone('items', (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: '11%' }} /><col /><col style={{ width: '17%' }} /><col style={{ width: '17%' }} /></colgroup>
            <thead>
              <tr>
                <th style={{ ...head, textAlign: 'center' }}>{labels.quantity}</th>
                <th style={{ ...head, textAlign: 'left' }}>{labels.designation}</th>
                <th style={{ ...head, textAlign: 'right' }}>{labels.unitPrice} ({data.currency})</th>
                <th style={{ ...head, textAlign: 'right' }}>{labels.lineTotal} ({data.currency})</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l, i) => (
                <tr key={i}>
                  <td style={{ ...cell, textAlign: 'center' }}>{l.quantity}</td>
                  <td style={{ ...cell, overflowWrap: 'anywhere' }}>{l.name}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{money(l.unitPrice)}</td>
                  <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{money(l.unitPrice * l.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}

        {zone('totals', (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={cell}>{labels.subtotal}</td><td style={{ ...cell, textAlign: 'right' }}>{money(subtotal)} {data.currency}</td></tr>
              <tr><td style={cell}>{labels.discount}</td><td style={{ ...cell, textAlign: 'right' }}>{data.discount > 0 ? `- ${money(data.discount)} ${data.currency}` : '-'}</td></tr>
              <tr><td style={head}>{labels.grandTotal}</td><td style={{ ...head, textAlign: 'right' }}>{money(total)} {data.currency}</td></tr>
            </tbody>
          </table>
        ))}

        {zone('words', (
          <div>
            {labels.amountInWords} <b>{numberToFrenchWords(integer)} {data.currency === 'FC' ? 'Francs Congolais' : 'Dollars Américains'}{cents > 0 ? ` et ${cents} cents` : ''}</b>.
          </div>
        ))}

        {zone('notes', data.notes ? <div style={{ whiteSpace: 'pre-line' }}>{data.notes}</div> : editable ? <div style={{ opacity: 0.5 }}>Notes et conditions</div> : null)}

        {zone('stamp', (data.paid || data.cancelled || editable) ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%',
            color: data.cancelled ? '#dc2626' : '#e11d48', opacity: data.paid || data.cancelled ? 0.55 : 0.25,
            fontWeight: 900, fontSize: `${(zones.stamp.h / 100) * page.h * 0.45}mm`, letterSpacing: 2, transform: 'rotate(-8deg)',
          }}>
            {data.cancelled ? labels.cancelled : labels.paid}
          </div>
        ) : null)}

        {zone('signature', company?.signature
          ? <img src={company.signature} alt="Signature" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : editable ? <div style={{ opacity: 0.5, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Signature (Entreprise &amp; logo)</div> : null)}

        {zone('payment', company?.paymentLink && !data.paid && !data.cancelled
          ? <PaymentBlock company={company} qrSize={(zones.payment.h / 100) * page.h * 3.4} fontSize={style.fontSize} />
          : editable ? <div style={{ opacity: 0.5 }}>Paiement en ligne (lien dans Entreprise &amp; logo)</div> : null)}
      </div>
    </div>
  );
});

export default TemplateDocument;
