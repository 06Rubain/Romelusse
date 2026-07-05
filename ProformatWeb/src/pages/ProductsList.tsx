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

  useEffect(() => {
    loadProducts();
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
        <h1 style={{ marginBottom: '32px' }}>Catalogue de Produits</h1>
        
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
