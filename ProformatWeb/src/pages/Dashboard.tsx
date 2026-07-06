import { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, LogOut, BarChart3, Users, Printer, Activity as ActivityIcon } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { API_URL } from '../config';
import { fetchWithAuth } from '../api';

export default function Dashboard() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  
  const [invoicePage, setInvoicePage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const itemsPerPage = 10;
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/invoices`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setInvoices(data.map((inv: any) => ({ ...inv, id: inv._id })));
        } else {
          console.error("API did not return an array for invoices:", data);
          setInvoices([]);
        }
      } catch (err) {
        console.error("Erreur de chargement des factures :", err);
      }
    };
    
    const fetchActivities = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/activities`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setActivities(data);
        } else {
          console.error("API did not return an array for activities:", data);
          setActivities([]);
        }
      } catch (err) {
        console.error("Erreur de chargement des activités :", err);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchInvoices();
        fetchActivities();
      }
    });

    return () => unsubscribe();
  }, []);

  const totalRevenue = invoices.reduce((sum, inv) => {
    const val = parseFloat((inv.total || '').toString().replace(/[^0-9.]/g, '')) || 0;
    return sum + val;
  }, 0);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const paginatedInvoices = invoices.slice((invoicePage - 1) * itemsPerPage, invoicePage * itemsPerPage);
  const totalInvoicePages = Math.ceil(invoices.length / itemsPerPage);

  const paginatedActivities = activities.slice((activityPage - 1) * itemsPerPage, activityPage * itemsPerPage);
  const totalActivityPages = Math.ceil(activities.length / itemsPerPage);
  
  return (
    <div className="app-container">
      <div className="sidebar">
        <div style={{ marginBottom: '40px' }}>
          <h2 className="gradient-text" style={{ margin: 0 }}>Mélanine Print</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Admin Dashboard</span>
        </div>
        
        <nav style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(0,168,181,0.1)', color: 'var(--primary)', borderRadius: '8px', cursor: 'pointer', marginBottom: '10px' }}>
            <BarChart3 size={20} />
            <strong>Tableau de bord</strong>
          </div>
          <div onClick={() => navigate('/invoice')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.2s' }}>
            <Plus size={20} />
            <span>Nouvelle Facture</span>
          </div>
          <div onClick={() => navigate('/products')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.2s' }}>
            <FileText size={20} />
            <span>Produits & Services</span>
          </div>
          <div onClick={() => navigate('/profile')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.2s' }}>
            <Users size={20} />
            <span>Mon Profil</span>
          </div>
        </nav>

        <div onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', color: 'var(--danger)', cursor: 'pointer' }}>
          <LogOut size={20} />
          <span>Déconnexion</span>
        </div>
      </div>

      <div className="main-content animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h1>Aperçu des Factures</h1>
          <button className="btn btn-primary" onClick={() => navigate('/invoice')}>
            <Plus size={18} /> Créer une facture
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '40px' }}>
          <div className="card glass">
            <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Chiffre d'affaires</div>
            <h2 style={{ margin: 0, fontSize: '2rem' }}>{totalRevenue.toLocaleString()} $</h2>
          </div>
          <div className="card glass">
            <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Factures générées</div>
            <h2 style={{ margin: 0, fontSize: '2rem' }}>{invoices.length}</h2>
          </div>
          <div className="card glass">
            <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Clients uniques</div>
            <h2 style={{ margin: 0, fontSize: '2rem' }}>{new Set(invoices.map(i => i.client)).size}</h2>
          </div>
        </div>

        <div className="card glass">
          <h3 style={{ marginBottom: '20px' }}>Historique Récent</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Total</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 500 }}>{inv.number}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{inv.date}</td>
                    <td>{inv.client}</td>
                    <td><span className={`badge ${inv.type === 'Proforma' ? 'badge-info' : 'badge-success'}`}>{inv.type}</span></td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{inv.total}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Printer size={18} color="var(--primary)" style={{ cursor: 'pointer' }} onClick={() => navigate(`/invoice/${inv.id}`)} />
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune facture trouvée.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalInvoicePages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '15px' }}>
              <button className="btn btn-outline" disabled={invoicePage === 1} onClick={() => setInvoicePage(p => p - 1)}>Précédent</button>
              <span>Page {invoicePage} sur {totalInvoicePages}</span>
              <button className="btn btn-outline" disabled={invoicePage === totalInvoicePages} onClick={() => setInvoicePage(p => p + 1)}>Suivant</button>
            </div>
          )}
        </div>

        <div className="card glass" style={{ marginTop: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <ActivityIcon size={24} color="var(--primary)" />
            <h3 style={{ margin: 0 }}>Historique des Connexions et Activités</h3>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date & Heure</th>
                  <th>Utilisateur</th>
                  <th>Action</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                {paginatedActivities.map(act => (
                  <tr key={act._id}>
                    <td style={{ color: 'var(--text-muted)' }}>{new Date(act.date).toLocaleString('fr-FR')}</td>
                    <td style={{ fontWeight: 500 }}>{act.userEmail}</td>
                    <td>
                      <span className={`badge ${act.action === 'Connexion' ? 'badge-success' : 'badge-info'}`}>
                        {act.action}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{act.details}</td>
                  </tr>
                ))}
                {activities.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune activité récente.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalActivityPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '15px' }}>
              <button className="btn btn-outline" disabled={activityPage === 1} onClick={() => setActivityPage(p => p - 1)}>Précédent</button>
              <span>Page {activityPage} sur {totalActivityPages}</span>
              <button className="btn btn-outline" disabled={activityPage === totalActivityPages} onClick={() => setActivityPage(p => p + 1)}>Suivant</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
