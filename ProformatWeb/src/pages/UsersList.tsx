import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users as UsersIcon, ShieldAlert, ShieldCheck } from 'lucide-react';
import { API_URL } from '../config';
import { fetchWithAuth } from '../api';

export default function UsersList() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const navigate = useNavigate();

  const loadUsers = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate('/login');
        return;
      }
      try {
        const res = await fetchWithAuth(`${API_URL}/api/users/${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          setCurrentUserData(data);
          if (data.role !== 'admin') {
            navigate('/dashboard'); // Kick out non-admins
          } else {
            loadUsers();
          }
        }
      } catch (err) {
        console.error(err);
        navigate('/dashboard');
      }
    };

    fetchCurrentUser();
  }, [navigate]);

  const toggleBlock = async (userId: string, currentStatus: boolean, email: string) => {
    if (email === 'nsimbanzebele@gmail.com') {
      alert("Impossible de bloquer le Super Administrateur.");
      return;
    }
    
    if (window.confirm(`Voulez-vous vraiment ${currentStatus ? 'débloquer' : 'bloquer'} l'utilisateur ${email} ?`)) {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/users/${userId}/block`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isBlocked: !currentStatus })
        });
        if (res.ok) {
          loadUsers();
        }
      } catch (err) {
        console.error(err);
        alert("Erreur lors de l'opération.");
      }
    }
  };

  if (loading || !currentUserData) return <div style={{ padding: '40px', textAlign: 'center' }}>Chargement...</div>;

  return (
    <div className="app-container">
      <div className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'var(--text-muted)', marginBottom: '40px' }} onClick={() => navigate('/profile')}>
          <ArrowLeft size={20} /> Retour au profil
        </div>
        
        <div style={{ padding: '20px', background: 'rgba(0,168,181,0.05)', borderRadius: '16px', border: '1px solid rgba(0,168,181,0.1)' }}>
          <h3 style={{ marginTop: 0, color: 'var(--primary)' }}><UsersIcon size={20} style={{ verticalAlign: 'middle', marginRight: '10px' }} />Espace Administrateur</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 0 }}>Gérez les accès de votre équipe. Bloquez les utilisateurs qui ne font plus partie de l'entreprise.</p>
        </div>
      </div>

      <div className="main-content animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h1>Gestion de l'Équipe</h1>
        </div>
        
        <div className="card glass">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>E-mail</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id} style={{ opacity: u.isBlocked ? 0.6 : 1 }}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}>
                      {u.photoURL ? (
                        <img src={u.photoURL} alt={u.displayName} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                          {(u.displayName || u.email).charAt(0).toUpperCase()}
                        </div>
                      )}
                      {u.displayName || 'Sans nom'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                    <td>
                      {u.role === 'admin' ? (
                        <span style={{ padding: '4px 10px', background: 'rgba(0,168,181,0.1)', color: 'var(--primary)', borderRadius: '12px', fontSize: '0.85rem' }}>Admin</span>
                      ) : (
                        <span style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', borderRadius: '12px', fontSize: '0.85rem' }}>Employé</span>
                      )}
                    </td>
                    <td>
                      {u.isBlocked ? (
                        <span style={{ color: 'var(--danger)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}><ShieldAlert size={16} /> Bloqué</span>
                      ) : (
                        <span style={{ color: '#10B981', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}><ShieldCheck size={16} /> Actif</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {u.email !== 'nsimbanzebele@gmail.com' && (
                        <button 
                          className="btn" 
                          style={{ 
                            padding: '6px 12px', 
                            fontSize: '0.85rem', 
                            background: u.isBlocked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                            color: u.isBlocked ? '#10B981' : 'var(--danger)', 
                            border: `1px solid ${u.isBlocked ? '#10B981' : 'var(--danger)'}` 
                          }}
                          onClick={() => toggleBlock(u._id, u.isBlocked, u.email)}
                        >
                          {u.isBlocked ? 'Débloquer' : 'Bloquer'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
