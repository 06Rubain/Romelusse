import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import type { User } from '../lib/types';
import { Alert } from '../components/ui';

type Mode = 'loading' | 'setup' | 'login' | '2fa';
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
  const [challenge, setChallenge] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ needsSetup: boolean }>('/auth/status')
      .then((s) => setMode(s.needsSetup ? 'setup' : 'login'))
      .catch((err) => { setError(errorMessage(err)); setMode('login'); });
  }, []);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/dashboard'} replace />;
  }

  const finish = (res: SessionResponse) => {
    setSession(res.token, res.user);
    navigate('/dashboard');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'setup') {
        finish(await api.post<SessionResponse>('/auth/setup', { email, password, displayName }));
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

  const Icon = mode === 'setup' ? UserPlus : mode === '2fa' ? ShieldCheck : LogIn;

  return (
    <div className="login-page gradient-bg">
      <div className="login-blob one" />
      <div className="login-blob two" />
      <div className="glass login-card animate-fade-in">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="login-icon"><Icon size={32} color="var(--primary)" /></div>
          <h1 className="gradient-text" style={{ fontSize: '2.2rem', marginBottom: 10 }}>Mélanine Print</h1>
          <p className="muted" style={{ margin: 0 }}>
            {mode === 'setup' && 'Première configuration : créez le compte administrateur'}
            {mode === 'login' && 'Bienvenue sur votre espace de gestion'}
            {mode === '2fa' && 'Saisissez le code de votre application d\'authentification'}
            {mode === 'loading' && 'Chargement…'}
          </p>
        </div>

        <Alert>{error}</Alert>

        {mode !== 'loading' && (
          <form onSubmit={submit}>
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
                  <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
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
            <button type="submit" className="btn btn-primary btn-block" disabled={busy || (mode === '2fa' && code.length !== 6)}>
              {busy ? 'Veuillez patienter…' : mode === 'setup' ? 'Créer le compte administrateur' : mode === '2fa' ? 'Vérifier' : 'Se connecter'}
            </button>
            {mode === '2fa' && (
              <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => { setMode('login'); setCode(''); }}>
                Retour
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
