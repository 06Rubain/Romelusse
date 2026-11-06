import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import type { DeliveryNote, Paginated } from '../lib/types';

// Bons de livraison d'une facture ou d'un bon de commande, et bouton pour en créer un
export default function InvoiceDeliveries({ invoiceId, canCreate }: { invoiceId: string; canCreate: boolean }) {
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  useEffect(() => {
    api.get<Paginated<DeliveryNote>>('/deliveries', { invoice: invoiceId, limit: 20 }).then((d) => setNotes(d.items)).catch(() => setNotes([]));
  }, [invoiceId]);

  return (
    <>
      {canCreate && (
        <Link className="btn btn-outline btn-block" to={`/delivery/new?invoice=${invoiceId}`}><Truck size={18} /> Bon de livraison</Link>
      )}
      {notes.length > 0 && (
        <ul className="list deliveries-list">
          {notes.map((n) => (
            <li key={n._id}>
              <Link to={`/delivery/${n._id}`}>{n.number}</Link>
              <span className="muted small">
                {formatDate(n.date)} · {n.lines.reduce((s, l) => s + l.delivered, 0).toLocaleString('fr-FR')} article(s){n.status === 'Annulé' ? ' · annulé' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
