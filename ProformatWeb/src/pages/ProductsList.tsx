import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Edit2, X } from 'lucide-react';
import { API_URL } from '../config';
import { fetchWithAuth } from '../api';

export default function ProductsList() {
  const [products, setProducts] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const loadProducts = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/products`);
      const data = await res.json();
      setProducts(data.map((p: any) => ({ ...p, id: p._id })));
    } catch (err) {
      console.error(err);
    }
  };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        loadProducts();
      }
    });

    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;
    setLoading(true);
    try {
      if (editingId) {
        // Mode Modification
        await fetchWithAuth(`${API_URL}/api/products/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, price })
        });
      } else {
        // Mode Ajout
        await fetchWithAuth(`${API_URL}/api/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, price })
        });
      }
      cancelEdit();
      loadProducts();
    } catch (err) {
      alert("Erreur lors de l'enregistrement du produit");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (prod: any) => {
    setEditingId(prod.id);
    setName(prod.name);
    setDescription(prod.description || '');
    setPrice(prod.price);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setPrice('');
  };

  const handleDelete = async (id: string) => {
    if(window.confirm('Voulez-vous vraiment supprimer ce produit ?')) {
      await fetchWithAuth(`${API_URL}/api/products/${id}`, { method: 'DELETE' });
      loadProducts();
    }
  };

  const importGrille = async () => {
    if(!window.confirm("Voulez-vous importer la grille tarifaire 2026 ?")) return;
    setLoading(true);
    const productsList = [
      { name: 'Papier ordinaire A4 N&B', price: '300 FC' },
      { name: 'Papier photo A4 N&B', price: '2000 FC' },
      { name: 'Papier Bristol A4 N&B', price: '1000 FC' },
      { name: 'Papier brillant A4 N&B', price: '2000 FC' },
      { name: 'Papier Doré A4 N&B', price: '1500 FC' },
      { name: 'Autocollant A4 N&B', price: '1000 FC' },
      { name: 'PHOTOCOPIE A4 N&B', price: '200 FC' },
      { name: 'Papier couché 135-150 g A4 N&B', price: '1000 FC' },
      { name: 'Papier couché 200-300 g A4 N&B', price: '1500 FC' },

      { name: 'Papier ordinaire A4 Couleur', price: '600 FC' },
      { name: 'Papier photo A4 Couleur', price: '3000 FC' },
      { name: 'Papier Bristol A4 Couleur', price: '1500 FC' },
      { name: 'Papier brillant A4 Couleur', price: '3000 FC' },
      { name: 'Papier Doré A4 Couleur', price: '1800 FC' },
      { name: 'Autocollant A4 Couleur', price: '1500 FC' },
      { name: 'PHOTOCOPIE A4 Couleur', price: '500 FC' },
      { name: 'Papier couché 135-150 g A4 Couleur', price: '1500 FC' },
      { name: 'Papier couché 200-300 g A4 Couleur', price: '1700 FC' },

      { name: 'Papier ordinaire A3 N&B', price: '1000 FC' },
      { name: 'Papier couché 135-150 g A3 N&B', price: '2000 FC' },
      { name: 'Papier couché 200-300 g A3 N&B', price: '2500 FC' },
      { name: 'Papier Bristol A3 N&B', price: '2000 FC' },
      { name: 'Papier autocollant A3 N&B', price: '2500 FC' },

      { name: 'Papier ordinaire A3 Couleur', price: '1200 FC' },
      { name: 'Papier couché 135-150 g A3 Couleur', price: '2500 FC' },
      { name: 'Papier Bristol A3 Couleur', price: '2800 FC' },
      { name: 'Papier couché 200-300 g A3 Couleur', price: '3500 FC' },
      { name: 'Papier autocollant A3 Couleur', price: '3000 FC' },

      { name: 'BÂCHE 1x1 m', price: '16000 FC' },
      { name: 'Vinyle 1x1 m', price: '22500 FC' },
      { name: 'Vinyle 1.50x1 m', price: '33750 FC' },
      { name: 'Wane way 1.50x1 m', price: '36000 FC' },
      { name: 'Black-out 1x2 m', price: '45000 FC' },

      { name: 'Papier photo A2', price: '16000 FC' },
      { name: 'Papier photo A1', price: '32000 FC' },
      { name: 'Papier photo A0', price: '57000 FC' },
      { name: 'Papier ordinaire A2', price: '10500 FC' },
      { name: 'Papier ordinaire A1', price: '21000 FC' },
      { name: 'Papier ordinaire A0', price: '36500 FC' },

      { name: 'Roll-Up', price: 'Sur devis' },
      { name: 'X-Stand', price: 'Sur devis' },
      { name: 'Cube', price: 'Sur devis' },
      { name: 'Forex', price: 'Sur devis' },
      { name: 'Backlight', price: 'Sur devis' },
      { name: 'Plexy', price: 'Sur devis' },
      { name: 'Mèche perforée', price: 'Sur devis' },
      { name: 'Drapeau', price: 'Sur devis' }
    ];

    try {
      for (const prod of productsList) {
        await fetchWithAuth(`${API_URL}/api/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: prod.name, description: '', price: prod.price })
        });
      }
      alert('Importation terminée !');
      loadProducts();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\\'importation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'var(--text-muted)', marginBottom: '40px' }} onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={20} /> Retour
        </div>
        
        <h3>{editingId ? 'Modifier un Produit' : 'Ajouter un Produit'}</h3>
        <form onSubmit={handleAdd}>
          <div className="input-group">
            <label>Nom</label>
            <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Description</label>
            <input type="text" className="input-field" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Prix (ex: 50 USD)</label>
            <input type="text" className="input-field" value={price} onChange={e => setPrice(e.target.value)} required />
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {editingId ? <Edit2 size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> : <Plus size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />} 
              {loading ? 'Enregistrement...' : (editingId ? 'Enregistrer' : 'Ajouter')}
            </button>
            {editingId && (
              <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={cancelEdit}>
                <X size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> Annuler
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="main-content animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h1>Catalogue de Produits</h1>
          <button className="btn btn-outline" onClick={importGrille} disabled={loading}>
            {loading ? 'Importation en cours...' : 'Importer Grille Tarifaire 2026'}
          </button>
        </div>
        
        <div className="card glass">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Description</th>
                  <th>Prix</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(prod => (
                  <tr key={prod.id}>
                    <td style={{ fontWeight: 500 }}>{prod.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{prod.description}</td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{prod.price}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Edit2 size={18} color="var(--primary)" style={{ cursor: 'pointer', marginRight: '15px' }} onClick={() => handleEdit(prod)} />
                      <Trash2 size={18} color="red" style={{ cursor: 'pointer' }} onClick={() => handleDelete(prod.id)} />
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun produit dans le catalogue.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
