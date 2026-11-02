import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, Download, Laptop, LogIn, RefreshCw, Smartphone, Tablet, Zap } from 'lucide-react';
import { useInstall } from '../lib/install';

type Platform = 'android' | 'ios' | 'desktop';

const detect = (ios: boolean): Platform => (ios ? 'ios' : /android/i.test(navigator.userAgent) ? 'android' : 'desktop');

const STEPS: Record<Platform, { title: string; icon: typeof Smartphone; steps: string[] }> = {
  android: {
    title: 'Téléphone Android',
    icon: Smartphone,
    steps: [
      'Ouvrez ce site dans Chrome (ou Samsung Internet).',
      'Appuyez sur « Installer maintenant » ci-dessus, ou sur le menu ⋮ puis « Installer l\'application ».',
      'L\'icône OmniCom apparaît sur votre écran d\'accueil.',
    ],
  },
  ios: {
    title: 'iPhone et iPad',
    icon: Tablet,
    steps: [
      'Ouvrez ce site dans Safari.',
      'Appuyez sur le bouton Partager (le carré avec une flèche vers le haut).',
      'Choisissez « Sur l\'écran d\'accueil », puis « Ajouter ».',
    ],
  },
  desktop: {
    title: 'Ordinateur (Windows, Mac)',
    icon: Laptop,
    steps: [
      'Ouvrez ce site dans Chrome ou Microsoft Edge.',
      'Cliquez sur « Installer maintenant » ci-dessus, ou sur l\'icône d\'installation à droite de la barre d\'adresse.',
      'OmniCom Facturation s\'ouvre dans sa propre fenêtre et se lance depuis le menu Démarrer ou le Dock.',
    ],
  },
};

// Page publique de téléchargement : installer OmniCom Facturation sur un téléphone ou un ordinateur
export default function Installer() {
  const { installed, canPrompt, ios, install } = useInstall();
  const [platform, setPlatform] = useState<Platform>(() => detect(ios));
  const [done, setDone] = useState(false);
  const current = STEPS[platform];

  return (
    <div className="installer">
      <section className="installer-hero">
        <img src="/omnicom-logo.png" alt="OmniCom" className="installer-logo" />
        <h1>OmniCom Facturation</h1>
        <p>Factures, proformas, encaissements et trésorerie de votre entreprise, sur votre téléphone et votre ordinateur.</p>
        {installed || done ? (
          <div className="installer-ok"><CheckCircle2 size={20} /> L'application est installée sur cet appareil.</div>
        ) : canPrompt ? (
          <button className="btn btn-primary btn-lg installer-cta" onClick={async () => setDone(await install())}><Download size={20} /> Installer maintenant</button>
        ) : (
          <a className="btn btn-primary btn-lg installer-cta" href="#etapes"><Download size={20} /> Comment installer</a>
        )}
        <Link to="/login" className="installer-login"><LogIn size={16} /> Se connecter à mon entreprise</Link>
      </section>

      <section className="installer-body">
        <div className="installer-points">
          <div><Zap size={20} /><strong>Rapide</strong><span>Une icône sur l'écran d'accueil, ouverture en plein écran.</span></div>
          <div><Building2 size={20} /><strong>Votre espace</strong><span>Chaque entreprise se connecte à son propre compte, avec ses données et son catalogue.</span></div>
          <div><RefreshCw size={20} /><strong>Toujours à jour</strong><span>Rien à mettre à jour : la dernière version s'installe toute seule.</span></div>
        </div>

        <div className="card" id="etapes">
          <div className="segmented" role="tablist">
            {(Object.keys(STEPS) as Platform[]).map((p) => {
              const Icon = STEPS[p].icon;
              return <button key={p} type="button" role="tab" aria-selected={platform === p} className={platform === p ? 'active' : ''} onClick={() => setPlatform(p)}><Icon size={16} /> {STEPS[p].title}</button>;
            })}
          </div>
          <ol className="installer-steps">
            {current.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <p className="muted small" style={{ margin: 0 }}>Ensuite, ouvrez l'application et connectez-vous avec l'e-mail et le mot de passe que votre administrateur (ou OmniCom) vous a donnés.</p>
        </div>
      </section>
    </div>
  );
}
