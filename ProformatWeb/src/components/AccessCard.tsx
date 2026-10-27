import { useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { accessMessage, loginUrl, type Access } from '../lib/access';

// Accès à transmettre à la personne : copie en un clic ou envoi par WhatsApp
export default function AccessCard({ access }: { access: Access }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(accessMessage(access));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* presse-papiers indisponible : les accès restent affichés */ }
  };
  return (
    <div className="access-card">
      <div><span>Adresse</span><strong>{loginUrl()}</strong></div>
      <div><span>E-mail</span><strong>{access.email}</strong></div>
      <div><span>Mot de passe</span><strong className="mono">{access.password}</strong></div>
      <div className="access-actions">
        <button type="button" className="btn btn-outline" onClick={copy}>
          {copied ? <><Check size={16} /> Copié</> : <><Copy size={16} /> Copier les accès</>}
        </button>
        <a className="btn btn-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(accessMessage(access))}`} target="_blank" rel="noreferrer">
          <MessageCircle size={16} /> Envoyer par WhatsApp
        </a>
      </div>
    </div>
  );
}
