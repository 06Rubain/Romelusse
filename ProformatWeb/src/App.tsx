import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import InvoiceGenerator from './pages/InvoiceGenerator';
import ProductsList from './pages/ProductsList';
import Profile from './pages/Profile';
import Verify2FA from './pages/Verify2FA';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-2fa" element={<Verify2FA />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/invoice" element={<InvoiceGenerator />} />
        <Route path="/invoice/:id" element={<InvoiceGenerator />} />
        <Route path="/products" element={<ProductsList />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Router>
  );
}

export default App;
