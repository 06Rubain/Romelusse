import type { Company } from '../lib/types';

// Lien de paiement imprimé sans « https:// », plus lisible sur papier
const displayLink = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

// Encadré « Payer en ligne » des factures : QR code, lien et moyens de paiement acceptés
export default function PaymentBlock({ company, qrSize = 74, fontSize = 11 }: { company: Pick<Company, 'paymentLink' | 'paymentQr' | 'paymentMethods'>; qrSize?: number; fontSize?: number }) {
  if (!company.paymentLink) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize, lineHeight: 1.35, color: '#000', textAlign: 'left' }}>
      {company.paymentQr && <img src={company.paymentQr} alt="QR code de paiement" style={{ width: qrSize, height: qrSize, flexShrink: 0 }} />}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>Payez en ligne</div>
        <div style={{ fontWeight: 700, wordBreak: 'break-all' }}>{displayLink(company.paymentLink)}</div>
        {company.paymentMethods?.length > 0 && (
          <div style={{ color: '#444', fontSize: fontSize * 0.9 }}>{company.paymentMethods.join(' · ')}</div>
        )}
      </div>
    </div>
  );
}
