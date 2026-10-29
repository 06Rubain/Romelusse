import { forwardRef } from 'react';
import { numberToFrenchWords } from '../utils/numberToWords';
import { formatDate, PRINT_SCALE } from '../lib/format';
import type { Company, Currency } from '../lib/types';
import { brandColors, headerBackground, labelBackground } from '../lib/brand';
import PaymentBlock from './PaymentBlock';

export interface DocumentLine { name: string; quantity: number; unitPrice: number }

interface Props {
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
  company: Company | null;
  printFormat: 'A4' | 'A5' | 'A6';
}

const amount = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


// Modèle imprimable de la facture, aux couleurs et au logo de l'entreprise
const InvoiceDocument = forwardRef<HTMLDivElement, Props>(function InvoiceDocument(props, ref) {
  const { type, number, client, clientActivity, issueDate, dueDate, currency, lines, discount, paid, cancelled, notes, company: settings, printFormat } = props;
  const { primary, secondary, accent } = brandColors(settings);
  const GRADIENT = `linear-gradient(to right, ${accent} 0%, ${primary} 80%, ${secondary} 100%)`;
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const total = Math.max(0, subtotal - discount);
  const scale = PRINT_SCALE[printFormat];
  const integer = Math.floor(total);
  const cents = Math.round((total - integer) * 100);
  const currencyWords = currency === 'FC' ? 'Francs Congolais' : 'Dollars Américains';
  const cell = { textAlign: 'center' as const, padding: '5px 0', fontWeight: 'bold' as const, fontSize: 14 };

  return (
    <div ref={ref} id="print-area" style={{
      width: '210mm', minHeight: '297mm', margin: '0 auto', background: 'white', color: 'black', position: 'relative',
      boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontFamily: 'Arial, Helvetica, sans-serif',
      transform: scale === 1 ? 'none' : `scale(${scale})`, transformOrigin: 'top center',
      marginBottom: printFormat === 'A6' ? '-148.5mm' : printFormat === 'A5' ? '-88mm' : 0,
    }}>
      <div style={{
        ...headerBackground(settings), height: 130,
        borderBottomLeftRadius: 25, borderBottomRightRadius: 25, display: 'flex', alignItems: 'center',
        padding: '0 30px', margin: '0 10mm 30px 10mm', boxSizing: 'border-box',
      }}>
        {settings?.logo
          ? <img src={settings.logo} alt="Logo" style={{ width: 190, maxHeight: 110, objectFit: 'contain' }} />
          : <div style={{ width: 190, color: 'white', fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{settings?.name}</div>}
        <div style={{ width: 2, height: 90, background: 'white', margin: '0 30px' }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', marginBottom: 8, alignItems: 'center' }}>
            <div style={{ background: labelBackground(settings), color: 'white', padding: '6px 15px', fontWeight: 'bold', fontSize: 14, minWidth: 130, textAlign: 'center' }}>
              {type === 'Proforma' ? 'PROFORMA N°' : 'FACTURE N°'}
            </div>
            <div style={{ background: 'white', color: 'black', padding: '6px 15px', fontWeight: 'bold', fontSize: 14, width: 220 }}>: {number}</div>
          </div>
          <div style={{ color: 'white', fontSize: 18, display: 'flex' }}>
            <span style={{ width: 130, padding: '0 15px' }}>Client</span>
            <span style={{ fontWeight: 'bold' }}>: {client.toUpperCase() || 'CLIENT INCONNU'}</span>
          </div>
          {clientActivity && (
            <div style={{ color: 'white', fontSize: 16, display: 'flex', marginTop: 2 }}>
              <span style={{ width: 130, padding: '0 15px' }}>Activité/Réf</span>
              <span style={{ fontWeight: 'bold' }}>: {clientActivity.toUpperCase()}</span>
            </div>
          )}
          <div style={{ color: 'white', fontSize: 16, display: 'flex', marginTop: 4 }}>
            <span style={{ width: 130, padding: '0 15px' }}>Date</span>
            <span style={{ fontWeight: 'bold' }}>: {formatDate(issueDate)}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 30px', minHeight: 500, display: 'flex', flexDirection: 'column' }}>
        <div style={{ border: '1px solid black', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', background: GRADIENT, color: 'white', fontWeight: 'bold', fontSize: 15 }}>
            <div style={{ padding: 8, width: '10%', textAlign: 'center', borderRight: '2px solid white' }}>Qté</div>
            <div style={{ padding: 8, width: '60%', textAlign: 'center', borderRight: '2px solid white' }}>Désignation</div>
            <div style={{ padding: 8, width: '15%', textAlign: 'center', borderRight: '2px solid white' }}>P.U ({currency})</div>
            <div style={{ padding: 8, width: '15%', textAlign: 'center' }}>P.T ({currency})</div>
          </div>
          <div style={{ display: 'flex', flex: 1, minHeight: 350 }}>
            <div style={{ width: '10%', borderRight: '1px solid black', padding: '10px 0' }}>
              {lines.map((l, i) => <div key={i} style={cell}>{l.quantity}</div>)}
            </div>
            <div style={{ width: '60%', borderRight: '1px solid black', padding: 10 }}>
              {lines.map((l, i) => <div key={i} style={{ padding: '5px 0', fontSize: 14 }}>{l.name}</div>)}
            </div>
            <div style={{ width: '15%', borderRight: '1px solid black', padding: '10px 0' }}>
              {lines.map((l, i) => <div key={i} style={cell}>{amount(l.unitPrice)}</div>)}
            </div>
            <div style={{ width: '15%', padding: '10px 0' }}>
              {lines.map((l, i) => <div key={i} style={cell}>{amount(l.unitPrice * l.quantity)}</div>)}
            </div>
          </div>
          {[
            ['Total', `${amount(subtotal)} ${currency}`],
            ['Remise', discount > 0 ? `- ${amount(discount)} ${currency}` : '-'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', borderTop: '1px solid black', fontSize: 15, fontWeight: 'bold' }}>
              <div style={{ width: '85%', padding: 6, textAlign: 'center', borderRight: '1px solid black' }}>{label}</div>
              <div style={{ width: '15%', padding: 6, textAlign: 'center' }}>{value}</div>
            </div>
          ))}
          <div style={{ display: 'flex', borderTop: '1px solid black', fontSize: 15, fontWeight: 'bold', background: GRADIENT, color: 'white' }}>
            <div style={{ width: '85%', padding: 6, textAlign: 'center', borderRight: '1px solid black' }}>Total général</div>
            <div style={{ width: '15%', padding: 6, textAlign: 'center' }}>{amount(total)} {currency}</div>
          </div>
        </div>

        <div style={{ fontSize: 15, fontStyle: 'italic', marginTop: 15 }}>
          Montant en toutes lettres<br />
          <strong style={{ fontSize: 16, fontStyle: 'normal' }}>
            Arrêté à la somme de {numberToFrenchWords(integer)} {currencyWords}{cents > 0 ? ` et ${cents} cents` : ''}.
          </strong>
          {type === 'Facture' && dueDate && <div style={{ fontStyle: 'normal', fontSize: 13, marginTop: 6 }}>Échéance de paiement : <strong>{formatDate(dueDate)}</strong></div>}
          {notes && <div style={{ fontStyle: 'normal', fontSize: 13, marginTop: 6, whiteSpace: 'pre-line' }}>{notes}</div>}
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: 10 }}>
        <div style={{ position: 'absolute', right: 50, top: 0, textAlign: 'center', zIndex: 10 }}>
          {(paid || cancelled) && (
            <div style={{ color: cancelled ? '#f3b2b2' : '#f8d0d5', fontSize: 75, fontWeight: 900, fontFamily: 'Arial Black, sans-serif', letterSpacing: 2, opacity: 0.9, marginBottom: -25 }}>
              {cancelled ? 'ANNULÉ' : 'PAYÉ'}
            </div>
          )}
          <div style={{ fontSize: 13, position: 'relative', zIndex: 2 }}>Fait à {settings?.city || 'Kinshasa'} le {formatDate(issueDate)}</div>
          {settings?.signature
            ? <img src={settings.signature} alt="Signature" style={{ display: 'block', margin: '6px auto 0', height: 64, maxWidth: 190, objectFit: 'contain' }} />
            : <div style={{ height: 50 }} />}
          <div style={{ fontWeight: 'bold', fontSize: 14 }}>La direction</div>
          {settings && !paid && !cancelled && (
            <div style={{ marginTop: 14, width: 275 }}><PaymentBlock company={settings} /></div>
          )}
        </div>

        <div style={{ padding: '30px 40px 0 30px', fontSize: 11, lineHeight: 1.3, color: '#000', marginBottom: 20 }}>
          <div style={{ width: 200, height: 1, background: '#ccc', marginBottom: 15 }} />
          {settings?.address}<br />
          E-mail. <b>{settings?.email}</b><br />
          Tel: <b>{settings?.phone}</b><br /><br />
          Numéro d'impôt : <b>{settings?.taxNumber}</b><br />
          Identification nationale : <b>{settings?.nationalId}</b><br />
          RCCM : <b>{settings?.rccm}</b><br /><br />
          Coordonnées bancaires<br />
          <div style={{ display: 'flex', gap: 8, fontSize: 7, color: '#666', margin: '2px 0' }}>
            <span style={{ width: 45 }}>Banque</span><span style={{ width: 40 }}>Agence</span><span style={{ width: 70 }}>Compte</span><span style={{ width: 20 }}>Clé</span><span>Devise</span>
          </div>
          {settings?.bankName} : <span style={{ fontWeight: 'bold', fontSize: 12 }}>{settings?.bankAccount}</span><br />
          Nom de compte bancaire : <b>{settings?.legalName}</b>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, overflow: 'hidden', borderBottomLeftRadius: 25, borderBottomRightRadius: 25 }}>
        {settings?.footerImage
          ? <img src={settings.footerImage} alt="" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: `linear-gradient(to right, ${primary}, ${secondary})` }} />}
      </div>
    </div>
  );
});

export default InvoiceDocument;
