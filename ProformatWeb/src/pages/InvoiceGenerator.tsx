import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Plus, Trash2 } from 'lucide-react';
// @ts-ignore
import logoUrl from '../assets/ELEMENT FACTURE MP-01.png';
// @ts-ignore
import footerUrl from '../assets/ELEMENT FACTURE MP-03.png';
import { useReactToPrint } from 'react-to-print';
import { API_URL } from '../config';
import { fetchWithAuth } from '../api';

export default function InvoiceGenerator() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [clientName, setClientName] = useState('');
  const [type, setType] = useState('Proforma');
  const [invoiceNumber, setInvoiceNumber] = useState(`070-57-${Math.floor(Math.random() * 10000)}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toLocaleDateString('fr-FR'));
  
  const [catalog, setCatalog] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [quantity, setQuantity] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);
  const reactToPrintFn = useReactToPrint({ contentRef });

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/products`);
        const data = await res.json();
        setCatalog(data.map((doc: any) => ({ ...doc, id: doc._id })));
      } catch (err) {
        console.error("Erreur chargement catalogue :", err);
      }
    };

    const fetchInvoice = async () => {
      if (!id) return;
      try {
        const res = await fetchWithAuth(`${API_URL}/api/invoices/${id}`);
        const data = await res.json();
        if (data && !data.error) {
          setClientName(data.client || '');
          setType(data.type || 'Proforma');
          setInvoiceNumber(data.number || `070-57-${Math.floor(Math.random() * 10000)}`);
          setSelectedProducts(data.products || []);
          setInvoiceDate(data.date || new Date().toLocaleDateString('fr-FR'));
        }
      } catch (err) {
        console.error("Erreur chargement facture :", err);
      }
    };

    fetchCatalog();
    if (id) fetchInvoice();
  }, [id]);

  const addProduct = (prod: any, qty: number) => {
    const existing = selectedProducts.find(p => p.id === prod.id);
    if (existing) {
      setSelectedProducts(selectedProducts.map(p => p.id === prod.id ? { ...p, quantity: p.quantity + qty } : p));
    } else {
      setSelectedProducts([...selectedProducts, { ...prod, quantity: qty }]);
    }
  };

  const removeProduct = (idx: number) => {
    const arr = [...selectedProducts];
    arr.splice(idx, 1);
    setSelectedProducts(arr);
  };

  const total = selectedProducts.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.quantity, 0);

  const handlePrintAndSave = async () => {
    if (!clientName || selectedProducts.length === 0) {
      alert("Veuillez renseigner le client et au moins un produit.");
      return;
    }

    // Si on réimprime une facture existante (on a un 'id'), on ne la sauvegarde pas à nouveau.
    if (id) {
      reactToPrintFn();
      return;
    }

    // Sinon, c'est une nouvelle facture, on la sauvegarde.
    try {
      await fetchWithAuth(`${API_URL}/api/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: clientName,
          type,
          date: invoiceDate,
          total: total + ' USD',
          products: selectedProducts,
          number: invoiceNumber,
          status: 'En attente'
        })
      });

      reactToPrintFn();

    } catch (e: any) {
      console.error(e);
      alert("Erreur : " + (e.message || e));
    }
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'var(--text-muted)', marginBottom: '40px' }} onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={20} /> Retour
        </div>
        
        <h3>Détails de la Facture</h3>
        <div className="input-group">
          <label>Nom du Client</label>
          <input type="text" className="input-field" value={clientName} onChange={e => setClientName(e.target.value)} />
        </div>
        
        <div className="input-group">
          <label>Type de facture</label>
          <select className="input-field" value={type} onChange={e => setType(e.target.value)}>
            <option value="Proforma">Proforma</option>
            <option value="Achat">Facture d'Achat</option>
          </select>
        </div>
        <div className="input-group">
          <label>Ajouter un produit</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <select className="input-field" id="productSelect" style={{ flex: 1 }}>
              <option value="">-- Choisir un produit --</option>
              {catalog.map(prod => (
                <option key={prod.id} value={prod.id}>{prod.name} ({prod.price} $)</option>
              ))}
            </select>
            <input 
              type="number" 
              className="input-field" 
              style={{ width: '70px' }} 
              value={quantity} 
              min="1" 
              onChange={e => setQuantity(parseInt(e.target.value) || 1)} 
            />
            <button className="btn btn-outline" type="button" onClick={() => {
              const select = document.getElementById('productSelect') as HTMLSelectElement;
              if(!select.value) return;
              const prod = catalog.find(p => p.id === select.value);
              if(prod) addProduct(prod, quantity);
              select.value = '';
              setQuantity(1);
            }}>
              <Plus size={16} />
            </button>
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }} onClick={handlePrintAndSave}>
          <Printer size={18} /> {id ? 'Imprimer (PDF)' : 'Générer & Imprimer (PDF)'}
        </button>
      </div>

      <div className="main-content" style={{ backgroundColor: '#e5e7eb', padding: '40px' }}>
        {/* Printable Area - The exact invoice template */}
        <div ref={contentRef} id="print-area" style={{ 
          width: '210mm', 
          minHeight: '297mm', 
          margin: '0 auto', 
          background: 'white', 
          position: 'relative', 
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
          fontFamily: 'Arial, Helvetica, sans-serif'
        }}>
          
          {/* Header Banner */}
          <div style={{
            background: 'linear-gradient(to right, #009eb5 40%, #56a5c2 60%, #e28882 100%)',
            height: '130px',
            borderBottomLeftRadius: '25px',
            borderBottomRightRadius: '25px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 30px',
            position: 'relative',
            margin: '0 10mm 30px 10mm', /* Marge réduite à 1cm */
            boxSizing: 'border-box'
          }}>
             <img src={logoUrl} alt="Logo" style={{ width: '190px', objectFit: 'contain' }} />
             
             <div style={{ width: '2px', height: '90px', background: 'white', margin: '0 30px' }}></div>
             
             <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', marginBottom: '8px', alignItems: 'center' }}>
                  <div style={{ background: '#c92a2a', color: 'white', padding: '6px 15px', fontWeight: 'bold', fontSize: '14px', width: '130px', textAlign: 'center' }}>
                    FACTURE N°
                  </div>
                  <div style={{ background: 'white', color: 'black', padding: '6px 15px', fontWeight: 'bold', fontSize: '14px', width: '220px' }}>
                    : {invoiceNumber}
                  </div>
                </div>
                <div style={{ color: 'white', fontSize: '18px', display: 'flex' }}>
                  <span style={{ width: '130px', padding: '0 15px' }}>Client</span>
                  <span style={{ fontWeight: 'bold' }}>: {clientName.toUpperCase() || 'CLIENT INCONNU'}</span>
                </div>
                <div style={{ color: 'white', fontSize: '16px', display: 'flex', marginTop: '4px' }}>
                  <span style={{ width: '130px', padding: '0 15px' }}>Date</span>
                  <span style={{ fontWeight: 'bold' }}>: {invoiceDate}</span>
                </div>
             </div>
          </div>
          
          <div style={{ padding: '0 30px', minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
            
            {/* Table */}
            <div style={{ border: '1px solid black', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ 
                display: 'flex', 
                background: 'linear-gradient(to right, #b91d1d 0%, #eb5e5e 40%, #00a5bb 80%, #6892b1 100%)', 
                color: 'white', 
                fontWeight: 'bold', 
                fontSize: '15px' 
              }}>
                <div style={{ padding: '8px', width: '10%', textAlign: 'center', borderRight: '2px solid white' }}>Qté</div>
                <div style={{ padding: '8px', width: '60%', textAlign: 'center', borderRight: '2px solid white' }}>Désignation</div>
                <div style={{ padding: '8px', width: '15%', textAlign: 'center', borderRight: '2px solid white' }}>P.U$</div>
                <div style={{ padding: '8px', width: '15%', textAlign: 'center' }}>P.T$</div>
              </div>
              
              <div style={{ display: 'flex', flex: 1, minHeight: '350px' }}>
                <div style={{ width: '10%', borderRight: '1px solid black', padding: '10px 0' }}>
                  {selectedProducts.map((item, idx) => (
                    <div key={`qte-${idx}`} style={{ textAlign: 'center', padding: '5px 0', fontWeight: 'bold', fontSize: '14px' }}>{item.quantity}</div>
                  ))}
                </div>
                <div style={{ width: '60%', borderRight: '1px solid black', padding: '10px' }}>
                  {selectedProducts.map((item, idx) => (
                    <div key={`name-${idx}`} style={{ padding: '5px 0', fontSize: '14px' }}>{item.name}</div>
                  ))}
                </div>
                <div style={{ width: '15%', borderRight: '1px solid black', padding: '10px 0' }}>
                  {selectedProducts.map((item, idx) => (
                    <div key={`pu-${idx}`} style={{ textAlign: 'center', padding: '5px 0', fontWeight: 'bold', fontSize: '14px' }}>{item.price.toString().replace('.', ',')}</div>
                  ))}
                </div>
                <div style={{ width: '15%', padding: '10px 0' }}>
                  {selectedProducts.map((item, idx) => (
                    <div key={`pt-${idx}`} style={{ textAlign: 'center', padding: '5px 0', fontWeight: 'bold', fontSize: '14px' }}>{((parseFloat(item.price) || 0) * item.quantity).toString().replace('.', ',')}</div>
                  ))}
                </div>
              </div>
              
              <div style={{ display: 'flex', borderTop: '1px solid black', fontSize: '15px', fontWeight: 'bold' }}>
                <div style={{ width: '70%', padding: '6px', textAlign: 'center', borderRight: '1px solid black' }}>Total</div>
                <div style={{ width: '30%', padding: '6px', textAlign: 'center' }}>{total.toString().replace('.', ',')}</div>
              </div>
              <div style={{ display: 'flex', borderTop: '1px solid black', fontSize: '15px', fontWeight: 'bold' }}>
                <div style={{ width: '70%', padding: '6px', textAlign: 'center', borderRight: '1px solid black' }}>Remise</div>
                <div style={{ width: '30%', padding: '6px', textAlign: 'center' }}>-</div>
              </div>
              <div style={{ 
                display: 'flex', 
                borderTop: '1px solid black', 
                fontSize: '15px', 
                fontWeight: 'bold',
                background: 'linear-gradient(to right, #b91d1d 0%, #eb5e5e 40%, #00a5bb 80%, #6892b1 100%)',
                color: 'white'
              }}>
                <div style={{ width: '70%', padding: '6px', textAlign: 'center', borderRight: '1px solid black' }}>Total général</div>
                <div style={{ width: '30%', padding: '6px', textAlign: 'center' }}>{total.toString().replace('.', ',')}</div>
              </div>
            </div>
            
            <div style={{ fontSize: '15px', fontStyle: 'italic', marginTop: '15px' }}>
              Montant en toutes lettres<br/>
              <strong style={{ fontSize: '16px', fontStyle: 'normal' }}>Un montant de {total} USD</strong>
            </div>
          </div>

          {/* Footer Area */}
          <div style={{ position: 'relative', marginTop: '10px' }}>
            
            <div style={{ position: 'absolute', right: '50px', top: '0', textAlign: 'center', zIndex: 10 }}>
               <div style={{ color: '#f8d0d5', fontSize: '75px', fontWeight: '900', fontFamily: 'Arial Black, sans-serif', letterSpacing: '2px', opacity: 0.9, marginBottom: '-25px' }}>PAYÉ</div>
               <div style={{ fontSize: '13px', position: 'relative', zIndex: 2 }}>Fait à Kinshasa le {invoiceDate}</div>
               {/* Note: I would place a signature image here, but since I only have logoUrl, I'll draw a cursive text */}
               <div style={{ marginTop: '50px', fontWeight: 'bold', fontSize: '14px' }}>La direction</div>
            </div>

            <div style={{ padding: '30px 40px 0 30px', fontSize: '11px', lineHeight: 1.3, color: '#000', marginBottom: '20px' }}>
              <div style={{ width: '200px', height: '1px', background: '#ccc', marginBottom: '15px' }}></div>
              6, av. Macampagne, Q/Jolie-parc, Kinshasa/ Ngaliema.<br/>
              E-mail. <span style={{ fontWeight: 'bold' }}>melanineprint@hotmail.com</span><br/>
              Tel: <span style={{ fontWeight: 'bold' }}>+243 890 360 756 / 820 600 566</span><br/><br/>
              
              Numéro d'impôt : <span style={{ fontWeight: 'bold' }}>A2546990E</span><br/>
              Identification nationale : <span style={{ fontWeight: 'bold' }}>01-C1700-N79672H</span><br/>
              RCCM : <span style={{ fontWeight: 'bold' }}>CD/KNG/RCCM/25-A-06400</span><br/><br/>
              
              Coordonnees bancaire<br/>
              <div style={{ display: 'flex', gap: '8px', fontSize: '7px', color: '#666', marginTop: '2px', marginBottom: '2px' }}>
                <span style={{width: '45px'}}>Banque</span><span style={{width: '40px'}}>Agence</span><span style={{width: '70px'}}>Compte</span><span style={{width: '20px'}}>Clé</span><span>Devise</span>
              </div>
              RAWBANK : <span style={{ fontWeight: 'bold', fontSize: '12px', color: 'black' }}>05100-00004-01205505001-17 USD</span><br/>
              Nom de compte bancaire : <span style={{ fontWeight: 'bold' }}>ETS MELANINE PRINT</span>
            </div>
          </div>
          
          {/* Bottom Graphic Footer */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px', overflow: 'hidden', borderBottomLeftRadius: '25px', borderBottomRightRadius: '25px' }}>
             <img src={footerUrl} alt="Footer" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: A4;
            margin: 0;
          }
          .no-print { display: none !important; }
          .sidebar { display: none !important; }
          .main-content { padding: 0 !important; background: white !important; margin: 0 !important; }
          #print-area { box-shadow: none !important; width: 100% !important; max-width: none !important; }
        }
      `}</style>
    </div>
  );
}
