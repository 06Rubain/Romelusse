import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { formatMoney, toInputDate } from '../lib/format';
import { PAYMENT_METHODS, type Invoice } from '../lib/types';
import { Alert, Field, Modal } from './ui';

export default function PaymentModal({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(String(invoice.balance));
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [date, setDate] = useState(toInputDate());
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/invoices/${invoice._id}/payments`, { amount: parseFloat(amount.replace(',', '.')), method, date, reference, note });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Encaissement — ${invoice.number}`} onClose={onClose}>
      <p className="muted">
        {invoice.client} · Total {formatMoney(invoice.totalAmount, invoice.currency)} · Reste dû <strong>{formatMoney(invoice.balance, invoice.currency)}</strong>
      </p>
      <Alert>{error}</Alert>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label={`Montant (${invoice.currency})`}>
            <input className="input-field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
          </Field>
          <Field label="Mode de paiement">
            <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Référence (n° transaction, chèque…)">
            <input className="input-field" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        </div>
        <Field label="Note">
          <input className="input-field" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le paiement'}</button>
        </div>
      </form>
    </Modal>
  );
}
