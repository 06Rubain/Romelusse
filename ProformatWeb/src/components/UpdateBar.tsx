import { Sparkles } from 'lucide-react';
import { applyUpdate, useInstall } from '../lib/install';

// Nouvelle version disponible : mise à jour en un clic, au moment choisi par l'utilisateur
export default function UpdateBar() {
  const { updateReady } = useInstall();
  if (!updateReady) return null;
  return (
    <div className="update-bar no-print" role="status">
      <Sparkles size={18} />
      <span>Une nouvelle version d'OmniCom Facturation est prête.</span>
      <button type="button" className="btn btn-sm btn-primary" onClick={applyUpdate}>Mettre à jour</button>
    </div>
  );
}
