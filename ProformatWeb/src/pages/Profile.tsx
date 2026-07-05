import React, { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User as UserIcon } from 'lucide-react';
import { API_URL } from '../config';

export default function Profile() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/users/${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          setUserData(data);
        } else {
          // Si l'utilisateur n'est pas encore dans MongoDB (ex: ancien compte), 
          // on utilise les données de Firebase par défaut
          setUserData({
            displayName: user.displayName || 'Utilisateur',
            email: user.email,
            photoURL: user.photoURL || '',
            provider: user.providerData[0]?.providerId || 'email'
          });
        }
      } catch (err) {
        console.error("Erreur chargement profil :", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Chargement...</div>;

  return (
    <div className="app-container">
      <div className="main-content animate-fade-in" style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: 'radial-gradient(circle at top right, rgba(0, 168, 181, 0.1), transparent 400px), radial-gradient(circle at bottom left, rgba(0, 168, 181, 0.05), transparent 400px)'
      }}>
        <div className="glass" style={{ width: '100%', maxWidth: '600px', padding: '50px', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
          
          {/* Decorative background element */}
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'var(--primary)', opacity: '0.1', borderRadius: '50%', filter: 'blur(30px)' }}></div>

          <button 
            className="btn" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', background: 'transparent', border: 'none', padding: 0, marginBottom: '40px', fontSize: '0.95rem' }} 
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft size={18} /> Retour au tableau de bord
          </button>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
            <div style={{ position: 'relative', marginBottom: '24px' }}>
              {userData?.photoURL ? (
                <img src={userData.photoURL} alt="Profil" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(0, 168, 181, 0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} />
              ) : (
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #007c87)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '50px', boxShadow: '0 8px 32px rgba(0, 168, 181, 0.3)' }}>
                  <UserIcon size={60} />
                </div>
              )}
              <div style={{ position: 'absolute', bottom: '5px', right: '5px', width: '20px', height: '20px', backgroundColor: '#10B981', borderRadius: '50%', border: '3px solid #1A1A24', title: 'En ligne' }}></div>
            </div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '2.2rem', fontWeight: '700', letterSpacing: '-0.5px' }} className="gradient-text">{userData?.displayName || 'Utilisateur'}</h1>
            <span style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500', border: '1px solid rgba(255,255,255,0.1)' }}>Administrateur</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'transform 0.2s', cursor: 'default' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Adresse E-mail</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '500' }}>{userData?.email}</div>
              </div>
            </div>
            
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'transform 0.2s', cursor: 'default' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Méthode de connexion</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {userData?.provider === 'google.com' || userData?.provider === 'google' ? (
                    <><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px' }} /> Google</>
                  ) : userData?.provider === 'facebook.com' || userData?.provider === 'facebook' ? (
                    <><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/facebook.svg" alt="Facebook" style={{ width: '18px' }} /> Facebook</>
                  ) : (
                    <><div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={12} color="white" /></div> Email / Mot de passe</>
                  )}
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'transform 0.2s', cursor: 'default' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Membre depuis</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '500' }}>
                  {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Aujourd\'hui'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
