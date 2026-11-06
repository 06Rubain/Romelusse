import { useCallback, useEffect, useState } from 'react';
import { BellRing, Check, X } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import type { PaymentNotice } from '../lib/types';
import { useFeedback } from './feedback';
import { Alert } from './ui';

// Paiements annoncés par le client depuis sa page (« J'ai payé ») : à vérifier sur le relevé Mobile Money ou bancaire, puis confirmer
export default function PaymentNotices({ invoiceId, canHandle, onChanged }: { invoiceId: string; canHandle: boolean; onChanged: () => void }) {
  const [notices, setNotices] = useState<PaymentNotice[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const { confirm, toast } = useFeedback();

  const load = useCallback(async () => {
    try { setNotices(await api.get<PaymentNotice[]>(`/invoices/${invoiceId}/notices`)); } catch { /* hors ligne : rien à afficher */ }
  }, [invoiceId]);
  useEffect(() => { load(); }, [load]);

  const pending = notices.filter((n) => n.status === 'En attente');
  if (!pending.length) return null;

  const act = async (n: PaymentNotice, action: 'confirm' | 'reject') => {
    if (action === 'reject' && !(await confirm({ title: 'Refuser ce paiement ?', message: `Le client verra que le paiement de ${formatMoney(n.amount, n.currency)} (réf. ${n.reference}) n'a pas été retrouvé.`, confirmLabel: 'Refuser', danger: true }))) return;
    setBusy(n._id);
    setError('');
    try {
      await api.post(`/invoices/${invoiceId}/notices/${n._id}/${action}`);
      toast(action === 'confirm' ? `Paiement de ${formatMoney(n.amount, n.currency)} encaissé.` : 'Paiement refusé.');
      await load();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="notice-panel">
      <div className="notice-panel-title"><BellRing size={18} /> Le client annonce {pending.length > 1 ? `${pending.length} paiements` : 'un paiement'}</div>
      {pending.map((n) => (
        <div key={n._id} className="notice-item">
          <div>
            <strong>{formatMoney(n.amount, n.currency)}</strong> par {n.provider}
            <div className="muted small">Réf. {n.reference}{n.payerPhone ? ` · ${n.payerPhone}` : ''}{n.payerName ? ` · ${n.payerName}` : ''} · {formatDate(n.createdAt)}</div>
          </div>
          {canHandle && (
            <div className="row-gap">
              <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => act(n, 'confirm')}><Check size={15} /> Reçu</button>
              <button className="btn btn-ghost btn-sm text-danger" disabled={!!busy} onClick={() => act(n, 'reject')}><X size={15} /> Pas reçu</button>
            </div>
          )}
        </div>
      ))}
      <p className="muted small">Vérifiez d'abord sur votre téléphone ou votre relevé que l'argent est bien arrivé.</p>
      <Alert>{error}</Alert>
    </div>
  );
}
