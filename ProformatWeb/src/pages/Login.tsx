import { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { API_URL } from '../config';
import { fetchWithAuth } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
    } catch (err) {
      console.error("Erreur d'enregistrement MongoDB :", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      await saveUserToMongoDB(res.user, 'email');
      navigate('/dashboard');
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
      await saveUserToMongoDB(res.user, 'google');
      navigate('/dashboard');
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
      await saveUserToMongoDB(res.user, 'facebook');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container gradient-bg" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 className="gradient-text">Mélanine Print</h1>
          <p style={{ color: 'var(--text-muted)' }}>Tableau de bord de facturation</p>
        </div>

        {error && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Adresse E-mail</label>
            <input 
              type="email" 
              className="input-field" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="input-group">
            <label>Mot de passe</label>
            <input 
              type="password" 
              className="input-field" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
            <LogIn size={18} />
            {loading ? 'Connexion...' : 'Se connecter'}
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
            style={{ width: '100%', backgroundColor: 'white', color: '#757575', border: '1px solid #ddd', display: 'flex', justifyContent: 'center', gap: '10px' }} 
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
