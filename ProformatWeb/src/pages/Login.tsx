import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FileText, Users, Wallet } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { APP_NAME, type User } from '../lib/types';
import { Alert } from '../components/ui';
import ThemeToggle from '../components/ThemeToggle';

type Mode = 'loading' | 'unavailable' | 'setup' | 'login' | '2fa';
interface SessionResponse { token: string; user: User }
interface LoginResponse extends Partial<SessionResponse> { requires2fa?: boolean; challenge?: string }

export default function Login() {
  const { user, setSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [challenge, setChallenge] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get<{ needsSetup: boolean }>('/auth/status'), api.get<{ setupKey: boolean }>('/health')])
      .then(([s, health]) => {
        if (!s.needsSetup) setMode('login');
        else if (health.setupKey) setMode('setup');
        else {
          // Ni compte OmniCom ni clé d'installation : la configuration du serveur est à compléter
          setError('Aucun compte OmniCom n\'existe encore. Définissez OMNICOM_ADMIN_PASSWORD dans Vercel (Settings → Environment Variables) puis redéployez : le compte administrateur sera créé automatiquement.');
          setMode('unavailable');
        }
      })
      // Sans réponse du serveur, impossible de savoir s'il faut installer ou se connecter
      .catch((err) => { setError(errorMessage(err)); setMode('unavailable'); });
  }, []);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : user.isSuperAdmin ? '/platform' : '/dashboard'} replace />;
  }

  const finish = (res: SessionResponse) => {
    setSession(res.token, res.user);
    navigate(res.user.isSuperAdmin ? '/platform' : '/dashboard');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'setup') {
        finish(await api.post<SessionResponse>('/auth/setup', { email, password, displayName, setupKey }));
      } else if (mode === 'login') {
        const res = await api.post<LoginResponse>('/auth/login', { email, password });
        if (res.requires2fa && res.challenge) {
          setChallenge(res.challenge);
          setMode('2fa');
        } else if (res.token && res.user) {
          finish(res as SessionResponse);
        }
      } else if (mode === '2fa') {
        finish(await api.post<SessionResponse>('/auth/login/2fa', { challenge, code }));
      }
    } catch (err) {
      setError(errorMessage(err));
      if (mode === '2fa' && /expirée/.test(errorMessage(err))) setMode('login');
    } finally {
      setBusy(false);
    }
  };

  const heading = mode === 'setup' ? 'Installation' : mode === '2fa' ? 'Vérification' : 'Bon retour 👋';

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="logo-mark"><span>O</span>{APP_NAME}</div>
        <div>
          <h2>Vos factures et proformas, simplement.</h2>
          <p>Créez des documents professionnels à votre logo en quelques clics, suivez vos encaissements et pilotez votre activité.</p>
          <ul className="login-points">
            <li><span><FileText size={16} /></span>Factures et proformas à vos couleurs, prêtes à imprimer</li>
            <li><span><Wallet size={16} /></span>Encaissements, créances et stock suivis automatiquement</li>
            <li><span><Users size={16} /></span>Chaque collaborateur avec ses propres droits</li>
          </ul>
        </div>
        <small style={{ color: '#8ea0b8' }}>Plateforme éditée par OmniCom</small>
      </section>

      <section className="login-panel">
        <div className="theme-corner"><ThemeToggle /></div>
        <div className="login-card animate-fade-in">
          <h1>{heading}</h1>
          <p className="lead">
            {mode === 'setup' && 'Créez le compte super-administrateur OmniCom.'}
            {mode === 'login' && 'Connectez-vous pour accéder à votre espace.'}
            {mode === '2fa' && 'Saisissez le code à 6 chiffres de votre application d\'authentification.'}
            {mode === 'loading' && 'Chargement…'}
            {mode === 'unavailable' && 'La configuration du serveur est à compléter.'}
          </p>

        <Alert>{error}</Alert>

        {mode === 'unavailable' && (
          <button className="btn btn-primary btn-block" onClick={() => window.location.reload()}>Réessayer</button>
        )}

        {(mode === 'setup' || mode === 'login' || mode === '2fa') && (
          <form onSubmit={submit}>
            {mode === 'setup' && (
              <label className="input-group">
                <span className="label">Clé d'installation</span>
                <input type="password" className="input-field" value={setupKey} onChange={(e) => setSetupKey(e.target.value)} required autoComplete="off" />
                <small className="muted">Valeur de SETUP_KEY définie sur le serveur</small>
              </label>
            )}
            {mode === 'setup' && (
              <label className="input-group">
                <span className="label">Nom complet</span>
                <input className="input-field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex : Rubain Mpunanti" />
              </label>
            )}
            {mode !== '2fa' && (
              <>
                <label className="input-group">
                  <span className="label">E-mail</span>
                  <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="vous@entreprise.com" required autoFocus />
                </label>
                <label className="input-group">
                  <span className="label">Mot de passe</span>
                  <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} minLength={mode === 'setup' ? 8 : undefined} placeholder="••••••••" required />
                  {mode === 'setup' && <small className="muted">8 caractères minimum</small>}
                </label>
              </>
            )}
            {mode === '2fa' && (
              <label className="input-group">
                <span className="label">Code à 6 chiffres</span>
                <input className="input-field code-input" inputMode="numeric" autoComplete="one-time-code" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoFocus required />
              </label>
            )}
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy || (mode === '2fa' && code.length !== 6)}>
              {busy ? 'Veuillez patienter…' : mode === 'setup' ? 'Créer le compte OmniCom' : mode === '2fa' ? 'Vérifier' : 'Se connecter'}
            </button>
            {mode === '2fa' && (
              <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => { setMode('login'); setCode(''); }}>
                Retour
              </button>
            )}
          </form>
        )}
        </div>
      </section>
    </div>
  );
}
