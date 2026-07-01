require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const cors = require('cors');
app.use(cors({
  origin: [
    'https://your-site.netlify.app',
    'http://localhost:3000'
  ],
  credentials: true
}));
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 days
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/locations', require('./routes/locations'));
app.use('/api/services', require('./routes/services'));
app.use('/api/booking', require('./routes/booking'));
app.use('/api/barber', require('./routes/barber'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/payment', require('./routes/payment'));

// Fallback - serve index for unknown routes (SPA-friendly)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Barber system running on http://localhost:${PORT}`);
});
