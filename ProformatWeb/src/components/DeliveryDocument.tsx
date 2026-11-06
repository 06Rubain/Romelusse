import { forwardRef } from 'react';
import { formatDate } from '../lib/format';
import type { Company, DeliveryLine } from '../lib/types';
import { brandColors, brighten, headerBackground, labelBackground } from '../lib/brand';

interface Props {
  number: string;
  client: string;
  clientActivity?: string;
  date: string;
  invoiceNumber?: string;
  deliveryAddress?: string;
  lines: DeliveryLine[];
  deliveredBy?: string;
  receivedBy?: string;
  notes?: string;
  cancelled?: boolean;
  company: Company | null;
}

const qty = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

// Bon de livraison imprimable, sur le modèle de l'entreprise : en-tête dégradé, tableau sans prix, signatures
const DeliveryDocument = forwardRef<HTMLDivElement, Props>(function DeliveryDocument(props, ref) {
  const { number, client, clientActivity, date, invoiceNumber, deliveryAddress, lines, deliveredBy, receivedBy, notes, cancelled, company: settings } = props;
  const { primary, secondary, accent } = brandColors(settings);
  // Bandeau du tableau : rouge de l'entreprise vers sa couleur principale, comme sur la charte
  const tableGradient = `linear-gradient(to right, ${accent} 0%, ${brighten(accent, 1.25)} 21%, ${secondary} 29%, color-mix(in srgb, ${primary} 45%, #8a6fc0) 48%, ${primary} 78%, color-mix(in srgb, ${primary} 45%, #8a6fc0) 100%)`;
  const totalOrdered = lines.reduce((s, l) => s + (l.ordered || 0), 0);
  const totalDelivered = lines.reduce((s, l) => s + (l.delivered || 0), 0);
  const cell = { padding: '7px 10px', fontSize: 14 } as const;
  const headCell = { padding: '8px 12px', fontWeight: 800, fontSize: 15, lineHeight: 1.1 } as const;

  return (
    <div ref={ref} id="print-area" style={{
      width: '210mm', minHeight: '297mm', margin: '0 auto', background: 'white', color: 'black', position: 'relative',
      boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontFamily: 'Arial, Helvetica, sans-serif', paddingBottom: 60, boxSizing: 'border-box',
    }}>
      <div style={{
        ...headerBackground(settings), height: 130, borderBottomLeftRadius: 25, borderBottomRightRadius: 25,
        display: 'flex', alignItems: 'center', padding: '0 30px', margin: '0 10mm 26px 10mm', boxSizing: 'border-box',
      }}>
        {settings?.logo
          ? <img src={settings.logo} alt="Logo" style={{ width: 190, maxHeight: 110, objectFit: 'contain' }} />
          : <div style={{ width: 190, color: 'white', fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{settings?.name}</div>}
        <div style={{ width: 2, height: 90, background: 'white', margin: '0 30px' }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', marginBottom: 8, alignItems: 'stretch' }}>
            <div style={{ background: labelBackground(settings), color: 'white', padding: '7px 15px', fontWeight: 'bold', fontSize: 16, whiteSpace: 'nowrap' }}>Bon de livraison</div>
            <div style={{ background: 'white', color: 'black', padding: '7px 15px', fontWeight: 'bold', fontSize: 15, flex: 1, display: 'flex', alignItems: 'center' }}>{number}</div>
          </div>
          <div style={{ color: 'white', fontSize: 16, display: 'flex' }}>
            <span style={{ width: 110, padding: '0 15px 0 0' }}>Client</span>
            <span style={{ fontWeight: 'bold' }}>: {client.toUpperCase() || 'CLIENT'}</span>
          </div>
          <div style={{ color: 'white', fontSize: 14, display: 'flex', marginTop: 2 }}>
            <span style={{ width: 110, padding: '0 15px 0 0' }}>Date</span>
            <span style={{ fontWeight: 'bold' }}>: {formatDate(date)}</span>
          </div>
          {invoiceNumber && (
            <div style={{ color: 'white', fontSize: 14, display: 'flex', marginTop: 2 }}>
              <span style={{ width: 110, padding: '0 15px 0 0' }}>Réf. document</span>
              <span style={{ fontWeight: 'bold' }}>: {invoiceNumber}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 30px' }}>
        {(clientActivity || deliveryAddress) && (
          <div style={{ fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
            {clientActivity && <div>Activité / Réf. : <b>{clientActivity}</b></div>}
            {deliveryAddress && <div>Lieu de livraison : <b>{deliveryAddress}</b></div>}
          </div>
        )}

        <div style={{ border: '1px solid #222' }}>
          <div style={{ display: 'flex', background: tableGradient, color: 'white', alignItems: 'center', minHeight: 54 }}>
            <div style={{ ...headCell, width: '58%', textAlign: 'center' }}>Désignation</div>
            <div style={{ ...headCell, width: '21%', borderLeft: '2px solid white' }}>Quantités<br />commandées</div>
            <div style={{ ...headCell, width: '21%', borderLeft: '2px solid white' }}>Quantités<br />livrées</div>
          </div>
          <div style={{ minHeight: 380 }}>
            {lines.map((l, i) => (
              <div key={i} style={{ display: 'flex', borderTop: i ? '1px solid #ddd' : 'none' }}>
                <div style={{ ...cell, width: '58%' }}>{l.name}</div>
                <div style={{ ...cell, width: '21%', textAlign: 'center', borderLeft: '1px solid #222', fontWeight: 'bold' }}>{l.ordered ? qty(l.ordered) : '—'}</div>
                <div style={{ ...cell, width: '21%', textAlign: 'center', borderLeft: '1px solid #222', fontWeight: 'bold' }}>{qty(l.delivered)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', borderTop: '1px solid #222', fontWeight: 'bold', fontSize: 14 }}>
            <div style={{ ...cell, width: '58%', textAlign: 'center' }}>Total</div>
            <div style={{ ...cell, width: '21%', textAlign: 'center', borderLeft: '1px solid #222' }}>{totalOrdered ? qty(totalOrdered) : '—'}</div>
            <div style={{ ...cell, width: '21%', textAlign: 'center', borderLeft: '1px solid #222' }}>{qty(totalDelivered)}</div>
          </div>
        </div>

        {notes && <div style={{ fontSize: 13, marginTop: 12, whiteSpace: 'pre-line' }}>{notes}</div>}

        <div style={{ display: 'flex', gap: 30, marginTop: 28, fontSize: 13 }}>
          {[['Livré par', deliveredBy], ['Reçu par (nom, date et signature)', receivedBy]].map(([label, name]) => (
            <div key={label} style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 6 }}>{label}</div>
              <div style={{ minHeight: 18 }}>{name}</div>
              <div style={{ borderBottom: '1px solid #333', height: 54 }} />
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, lineHeight: 1.35, marginTop: 26, color: '#111' }}>
          <div style={{ width: 200, height: 1, background: '#ccc', marginBottom: 10 }} />
          <b>{settings?.legalName || settings?.name}</b>{settings?.address ? ` · ${settings.address}` : ''}<br />
          {settings?.phone && <>Tél : <b>{settings.phone}</b> </>}{settings?.email && <>· E-mail : <b>{settings.email}</b></>}<br />
          {settings?.rccm && <>RCCM : <b>{settings.rccm}</b> </>}{settings?.taxNumber && <>· N° impôt : <b>{settings.taxNumber}</b></>}
        </div>
      </div>

      {cancelled && (
        <div style={{ position: 'absolute', top: '42%', left: 0, right: 0, textAlign: 'center', color: '#f3b2b2', fontSize: 90, fontWeight: 900, fontFamily: 'Arial Black, sans-serif', transform: 'rotate(-12deg)', opacity: 0.85 }}>
          ANNULÉ
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, overflow: 'hidden', borderTopLeftRadius: 25, borderTopRightRadius: 25 }}>
        {settings?.footerImage
          ? <img src={settings.footerImage} alt="" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: `linear-gradient(to right, ${primary}, ${secondary})` }} />}
      </div>
    </div>
  );
});

export default DeliveryDocument;
