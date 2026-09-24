import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { API_URL } from '../config';
import '../index.css';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('jwt', data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container gradient-bg" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Animated background */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(0,168,181,0.2) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%', filter: 'blur(40px)', animation: 'float 6s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(168,85,247,0.2) 0%, rgba(0,0,0,0) 70%)', borderRadius: '50%', filter: 'blur(40px)', animation: 'float 8s ease-in-out infinite reverse' }} />

      <div className="glass animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '40px', position: 'relative', zIndex: 10, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-block', padding: '15px', background: 'rgba(0,168,181,0.1)', borderRadius: '50%', marginBottom: '15px' }}>
            <LogIn size={32} color="var(--primary)" />
          </div>
          <h1 className="gradient-text" style={{ fontSize: '2.2rem', marginBottom: '10px' }}>Mélanine Print</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>Bienvenue sur votre espace de gestion</p>
        </div>

        {error && (
          <div className="animate-fade-in" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger)', color: 'var(--danger)', padding: '12px 16px', borderRadius: '4px', marginBottom: '20px', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="input-group" style={{ marginBottom: '16px' }}>
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
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem', fontWeight: 600, borderRadius: '8px', boxShadow: '0 4px 14px 0 rgba(0, 168, 181, 0.39)', transition: 'all 0.3s' }} disabled={loading}>
            {loading ? <span style={{ opacity: 0.8 }}>Connexion en cours...</span> : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
