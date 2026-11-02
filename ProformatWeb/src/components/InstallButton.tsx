import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useInstall } from '../lib/install';

// Installe l'application en un clic quand le navigateur le permet, sinon ouvre la page d'explications
export default function InstallButton({ className = 'btn btn-outline', label = 'Installer l\'application', onDone }: { className?: string; label?: string; onDone?: () => void }) {
  const { installed, canPrompt, install } = useInstall();
  const navigate = useNavigate();
  if (installed) return null;
  return (
    <button type="button" className={className} onClick={async () => {
      if (canPrompt) await install();
      else navigate('/installer');
      onDone?.();
    }}>
      <Download size={18} /> <span>{label}</span>
    </button>
  );
}
