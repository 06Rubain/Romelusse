import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CloudOff, RefreshCw } from 'lucide-react';
import { currentScope } from '../lib/api';
import { dismissFailed, flush, useOffline } from '../lib/offline';
import { useFeedback } from './feedback';

// État de la connexion et des saisies en attente, affiché en haut de l'application quand c'est utile
export default function OfflineBanner() {
  const { online, pending, syncing, failed, lastSent } = useOffline();
  const { toast } = useFeedback();
  const [showFailed, setShowFailed] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (lastSent && lastSent.at !== shownAt.current) {
      shownAt.current = lastSent.at;
      toast(`${lastSent.count} saisie(s) faite(s) hors ligne envoyée(s) au serveur.`);
      window.dispatchEvent(new Event('omnicom:synced'));
    }
  }, [lastSent, toast]);

  if (online && !pending && !failed.length) return null;

  return (
    <div className="offline-stack no-print">
      {!online && (
        <div className="offline-banner offline">
          <CloudOff size={18} />
          <span>
            <strong>Hors ligne.</strong> Vous voyez les dernières données enregistrées sur cet appareil ; factures, encaissements, dépenses et clients saisis seront envoyés au retour de la connexion.
            {pending > 0 && <> <strong>{pending} saisie(s) en attente.</strong></>}
          </span>
        </div>
      )}
      {online && pending > 0 && (
        <div className="offline-banner syncing">
          <RefreshCw size={18} className={syncing ? 'spin' : ''} />
          <span>{syncing ? 'Envoi des saisies faites hors ligne…' : `${pending} saisie(s) faite(s) hors ligne à envoyer.`}</span>
          {!syncing && <button type="button" className="btn btn-sm btn-outline" onClick={() => flush()}>Envoyer maintenant</button>}
        </div>
      )}
      {failed.length > 0 && (
        <div className="offline-banner failed">
          <AlertTriangle size={18} />
          <span>
            <strong>{failed.length} saisie(s) refusée(s) par le serveur.</strong>{' '}
            <button type="button" className="link-button" onClick={() => setShowFailed((v) => !v)}>{showFailed ? 'Masquer' : 'Voir le détail'}</button>
            {showFailed && (
              <ul>{failed.map((f) => <li key={f.key}>{f.label} — {f.error}</li>)}</ul>
            )}
          </span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => dismissFailed(currentScope())}>Ignorer</button>
        </div>
      )}
    </div>
  );
}
