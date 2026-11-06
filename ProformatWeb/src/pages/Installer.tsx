import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, CloudOff, Download, Laptop, LogIn, QrCode, RefreshCw, ShieldCheck, Smartphone, Tablet } from 'lucide-react';
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
  const [qr, setQr] = useState('');

  // Sur ordinateur : QR code pour ouvrir cette page sur son téléphone et y installer l'application
  useEffect(() => {
    if (platform !== 'desktop') return;
    import('qrcode').then((q) => q.toDataURL(`${window.location.origin}/installer`, { margin: 1, width: 220 })).then(setQr).catch(() => setQr(''));
  }, [platform]);

  return (
    <div className="installer">
      <section className="installer-hero">
        <img src="/omnicom-logo-dark.png" alt="OmniCom" className="installer-logo" />
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
          <div><Building2 size={20} /><strong>Votre espace</strong><span>Chaque entreprise se connecte à son propre compte, avec ses données et son catalogue.</span></div>
          <div><CloudOff size={20} /><strong>Même hors ligne</strong><span>Consultez vos données et saisissez factures, encaissements et dépenses sans connexion : tout part au retour du réseau.</span></div>
          <div><RefreshCw size={20} /><strong>Toujours à jour</strong><span>Les nouvelles versions arrivent toutes seules : un clic sur « Mettre à jour ».</span></div>
          <div><ShieldCheck size={20} /><strong>Sécurisé</strong><span>Connexion chiffrée, données de chaque entreprise séparées, double authentification possible.</span></div>
        </div>

        <div className="installer-shots">
          <img src="/screenshots/ordinateur-1.png" alt="Tableau de bord sur ordinateur" className="wide" />
          <img src="/screenshots/telephone-1.png" alt="Tableau de bord sur téléphone" />
          <img src="/screenshots/telephone-2.png" alt="Création d'une facture sur téléphone" />
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
          {platform === 'desktop' && qr && (
            <div className="installer-qr">
              <img src={qr} alt="QR code vers la page d'installation" />
              <div><strong><QrCode size={16} /> Sur votre téléphone</strong><span className="muted small">Scannez ce code avec l'appareil photo pour ouvrir cette page et installer l'application.</span></div>
            </div>
          )}
          <p className="muted small" style={{ margin: 0 }}>Ensuite, ouvrez l'application et connectez-vous avec l'e-mail et le mot de passe que votre administrateur (ou OmniCom) vous a donnés.</p>
        </div>
      </section>
    </div>
  );
}
