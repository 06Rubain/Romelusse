import { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, FacebookAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { API_URL } from '../config';
import { fetchWithAuth } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const logActivity = async (email: string, method: string) => {
    try {
      await fetchWithAuth(`${API_URL}/api/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: email,
          action: 'Connexion',
          details: `Connexion réussie via ${method}`
        })
      });
    } catch (err) {
      console.error("Erreur log activité :", err);
    }
  };

  const saveUserToMongoDB = async (user: any, provider: string) => {
    try {
      await fetchWithAuth(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          provider: provider
        })
      });
      const data = await res.json();
      await logActivity(user.email, provider);
      return data;
    } catch (err) {
      console.error("Erreur d'enregistrement MongoDB :", err);
      return null;
    }
  };

  const handlePostLogin = (userData: any) => {
    if (userData?.twoFactorEnabled) {
      sessionStorage.setItem('2faPending', 'true');
      navigate('/verify-2fa');
    } else {
      sessionStorage.setItem('2faVerified', 'true');
      navigate('/dashboard');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      const userData = await saveUserToMongoDB(res.user, 'email');
      handlePostLogin(userData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const userData = await saveUserToMongoDB(res.user, 'google');
      handlePostLogin(userData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new FacebookAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const userData = await saveUserToMongoDB(res.user, 'facebook');
      handlePostLogin(userData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Veuillez entrer votre adresse e-mail pour réinitialiser le mot de passe.");
      return;
    }
    setError('');
    setResetMessage('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMessage("Un e-mail de réinitialisation a été envoyé !");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container gradient-bg" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      
      {/* Animated background elements */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(0,168,181,0.2) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%', filter: 'blur(40px)', animation: 'float 6s ease-in-out infinite' }}></div>
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(168,85,247,0.2) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%', filter: 'blur(40px)', animation: 'float 8s ease-in-out infinite reverse' }}></div>

      <div className="glass animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '40px', position: 'relative', zIndex: 10, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-block', padding: '15px', background: 'rgba(0,168,181,0.1)', borderRadius: '50%', marginBottom: '15px' }}>
             <LogIn size={32} color="var(--primary)" />
          </div>
          <h1 className="gradient-text" style={{ fontSize: '2.2rem', marginBottom: '10px' }}>Mélanine Print</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>Bienvenue sur votre espace de gestion</p>
        </div>

        {error && <div className="animate-fade-in" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger)', color: 'var(--danger)', padding: '12px 16px', borderRadius: '4px', marginBottom: '20px', fontSize: '0.9rem' }}>{error}</div>}
        {resetMessage && <div className="animate-fade-in" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', borderLeft: '4px solid #22c55e', color: '#22c55e', padding: '12px 16px', borderRadius: '4px', marginBottom: '20px', fontSize: '0.9rem' }}>{resetMessage}</div>}

        <form onSubmit={handleLogin}>
          <div className="input-group" style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#888' }}>Adresse E-mail</label>
            <input 
              type="email" 
              className="input-field" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.3s' }}
              required 
            />
          </div>
          <div className="input-group" style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#888' }}>Mot de passe</label>
            <input 
              type="password" 
              className="input-field" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.3s' }}
              required 
            />
          </div>

          <div style={{ textAlign: 'right', marginBottom: '24px' }}>
            <button 
              type="button" 
              onClick={handleResetPassword}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.85rem', cursor: 'pointer', padding: 0, textDecoration: 'none', transition: 'opacity 0.2s' }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}
              disabled={loading}
            >
              Mot de passe oublié ?
            </button>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem', fontWeight: 600, borderRadius: '8px', boxShadow: '0 4px 14px 0 rgba(0, 168, 181, 0.39)', transition: 'all 0.3s' }} disabled={loading}>
            {loading ? <span style={{ opacity: 0.8 }}>Connexion en cours...</span> : 'Se connecter'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
          <span style={{ padding: '0 10px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>ou</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            type="button" 
            className="btn" 
            style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'center', gap: '10px', padding: '12px', transition: 'all 0.3s' }} 
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
            disabled={loading}
            onClick={handleGoogleLogin}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px' }} />
            Continuer avec Google
          </button>

          <button 
            type="button" 
            className="btn" 
            style={{ width: '100%', backgroundColor: '#1877F2', color: 'white', display: 'flex', justifyContent: 'center', gap: '10px' }} 
            disabled={loading}
            onClick={handleFacebookLogin}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/facebook.svg" alt="Facebook" style={{ width: '18px', filter: 'brightness(0) invert(1)' }} />
            Continuer avec Facebook
          </button>
        </div>
      </div>
    </div>
  );
}
