import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { auth } from '../firebase';
import { API_URL } from '../config';
import { fetchWithAuth } from '../api';

export default function Verify2FA() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || token.length !== 6) {
      setError("Le code doit contenir 6 chiffres.");
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        navigate('/login');
        return;
      }
      
      const res = await fetchWithAuth(`${API_URL}/api/2fa/validate-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, token })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem('2faVerified', 'true');
        navigate('/dashboard');
      } else {
        setError(data.error || "Code invalide.");
      }
    } catch (err) {
      console.error(err);
      setError("Une erreur s'est produite lors de la vérification.");
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
             <Shield size={32} color="var(--primary)" />
          </div>
          <h1 className="gradient-text" style={{ fontSize: '2.2rem', marginBottom: '10px' }}>Sécurité 2FA</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>Veuillez entrer le code à 6 chiffres généré par votre application Authenticator.</p>
        </div>

        {error && <div className="animate-fade-in" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger)', color: 'var(--danger)', padding: '12px 16px', borderRadius: '4px', marginBottom: '20px', fontSize: '0.9rem' }}>{error}</div>}

        <form onSubmit={handleVerify}>
          <div className="input-group" style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', textAlign: 'center', display: 'block' }}>Code Authenticator</label>
            <input 
              type="text" 
              className="input-field" 
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="000000"
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.3s', textAlign: 'center', fontSize: '1.5rem', letterSpacing: '5px' }}
              required 
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem', fontWeight: 600, borderRadius: '8px', boxShadow: '0 4px 14px 0 rgba(0, 168, 181, 0.39)', transition: 'all 0.3s' }} disabled={loading || token.length !== 6}>
            {loading ? <span style={{ opacity: 0.8 }}>Vérification...</span> : 'Vérifier'}
          </button>
        </form>
      </div>
    </div>
  );
}
