const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

require('dotenv').config();
const verifyToken = require('./middleware/authMiddleware');

const Product = require('./models/Product');
const Invoice = require('./models/Invoice');
const User = require('./models/User');
const Activity = require('./models/Activity');

const app = express();
app.use(helmet());
app.use(cors());
app.use(
  express.json({
    // Accepter les deux formes de content‑type JSON
    type: ['application/json', 'application/json; charset=utf-8'],
    // Hook de vérification : journaliser les payloads invalides
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
      } catch (_) {
        console.warn('⚠️  Payload JSON invalide reçu :', buf.toString());
        // Lever une exception déclenche le gestionnaire d’erreur intégré d’Express
        throw new Error('Invalid JSON');
      }
    },
  })
);


const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Trop de requêtes depuis cette adresse IP, veuillez réessayer plus tard.'
});
app.use('/api/', apiLimiter);

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/proformat';

// Ensure DB is connected before every request (Serverless best practice)
app.use((req, res, next) => { console.log('DB Middleware Path:', req.path); next(); });
// Ensure DB is connected before every request (Serverless best practice)
app.use(async (req, res, next) => {
  // Skip DB connection for authentication routes to avoid unnecessary DB errors during login
  if (req.path.startsWith('/api/auth')) {
    return next();
  }
  if (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log('MongoDB reconnected or connected successfully');
    } catch (err) {
      console.error('MongoDB connection error:', err);
      return res.status(500).json({ error: 'Database connection failed' });
    }
  }
  next();
});

app.use('/api', (req, res, next) => { if (req.path.startsWith('/auth')) { return next(); } verifyToken(req, res, next); });

// ---- Products API ----
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    const saved = await newProduct.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Invoices API ----
app.get('/api/invoices', async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/invoices/next-number', async (req, res) => {
  try {
    const count = await Invoice.countDocuments();
    // Ex: FAC-0001
    const nextNumber = `FAC-${String(count + 1).padStart(4, '0')}`;
    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/invoices/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const newInvoice = new Invoice(req.body);
    const saved = await newInvoice.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/invoices/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const updatedInvoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!updatedInvoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(updatedInvoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Users API ----
app.post('/api/users', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL, provider, password } = req.body;
    let user = await User.findOne({ uid });
    
    const role = (email === 'mpunantitarubain@gmail.com' || email === 'nsimbanzebele@gmail.com') ? 'admin' : 'user';
    
    // Hash password if provided
    let passwordHash = undefined;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }
    
    if (!user) {
      user = new User({ uid, email, displayName, photoURL, provider, role, passwordHash });
      await user.save();
    } else {
      user.displayName = displayName || user.displayName;
      user.photoURL = photoURL || user.photoURL;
      if (passwordHash) {
        user.passwordHash = passwordHash;
      }
      if ((email === 'mpunantitarubain@gmail.com' || email === 'nsimbanzebele@gmail.com') && user.role !== 'admin') {
        user.role = 'admin';
      }
      await user.save();
    }
    
    if (user.isBlocked) {
      return res.status(403).json({ error: 'Compte bloqué', isBlocked: true });
    }
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:uid', async (req, res) => {
  try {
    let user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Auto-promotion for Super Admin in case they didn't logout/login
    if ((user.email === 'mpunantitarubain@gmail.com' || user.email === 'nsimbanzebele@gmail.com') && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/users/:id/block', async (req, res) => {
  try {
    const { isBlocked } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Activities API ----
app.get('/api/activities', async (req, res) => {
  try {
    const activities = await Activity.find().sort({ date: -1 }).limit(100);
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Authentication ----
app.post('/api/auth/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required' });
    const hash = process.env.APP_PASSWORD_HASH;
    if (!hash) return res.status(500).json({ error: 'Server password not configured' });
    const valid = await bcrypt.compare(password, hash);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });
    const token = jwt.sign({ role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/activities', async (req, res) => {
  try {
    const newActivity = new Activity(req.body);
    const saved = await newActivity.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 2FA API ----
app.post('/api/2fa/generate', async (req, res) => {
  try {
    const { uid, email } = req.body;
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, 'Melanine Print', secret);
    
    // Save secret temporarily (not enabled yet)
    user.twoFactorSecret = secret;
    await user.save();

    const qrCodeImage = await qrcode.toDataURL(otpauthUrl);
    res.json({ secret, qrCodeImage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/2fa/verify', async (req, res) => {
  try {
    const { uid, token } = req.body;
    const user = await User.findOne({ uid });
    if (!user || !user.twoFactorSecret) return res.status(404).json({ error: 'User or secret not found' });

    const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
    if (isValid) {
      user.twoFactorEnabled = true;
      await user.save();
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Code invalide' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/2fa/validate-session', async (req, res) => {
  try {
    const { uid, token } = req.body;
    const user = await User.findOne({ uid });
    if (!user || !user.twoFactorEnabled) return res.status(400).json({ error: '2FA non activé ou utilisateur introuvable' });

    const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
    if (isValid) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Code invalide' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
