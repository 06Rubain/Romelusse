import type { Company } from '../lib/types';

// Lien de paiement imprimé sans « https:// », plus lisible sur papier
const displayLink = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

type PaymentInfo = Pick<Company, 'paymentLink' | 'paymentQr' | 'paymentMethods'> & { paymentAccounts?: Company['paymentAccounts'] };

// Encadré « Payez » des factures : QR code et lien de paiement en ligne, puis nos numéros Mobile Money et comptes
export default function PaymentBlock({ company, qrSize = 74, fontSize = 11 }: { company: PaymentInfo; qrSize?: number; fontSize?: number }) {
  const accounts = company.paymentAccounts || [];
  if (!company.paymentLink && !accounts.length) return null;
  return (
    <div style={{ fontSize, lineHeight: 1.35, color: '#000', textAlign: 'left' }}>
      {company.paymentLink && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {company.paymentQr && <img src={company.paymentQr} alt="QR code de paiement" style={{ width: qrSize, height: qrSize, flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>Payez en ligne</div>
            <div style={{ fontWeight: 700, wordBreak: 'break-all' }}>{displayLink(company.paymentLink)}</div>
            {company.paymentMethods?.length > 0 && (
              <div style={{ color: '#444', fontSize: fontSize * 0.9 }}>{company.paymentMethods.join(' · ')}</div>
            )}
          </div>
        </div>
      )}
      {accounts.length > 0 && (
        <div style={{ marginTop: company.paymentLink ? 6 : 0 }}>
          <div style={{ fontWeight: 700 }}>{company.paymentLink ? 'Ou payez directement' : 'Payez directement'}</div>
          {accounts.map((a, i) => (
            <div key={i} style={{ fontSize: fontSize * 0.95 }}>
              {a.label || a.provider} : <b>{a.number}</b>{a.holder ? ` (${a.holder})` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
