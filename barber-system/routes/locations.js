const express = require('express');
const router = express.Router();
const { supabase } = require('../db');

// GET all locations
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('locations').select('*').order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST new location (admin only)
router.post('/', async (req, res) => {
  if (!req.session.adminId) return res.status(401).json({ error: 'Unauthorized' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const { data, error } = await supabase.from('locations').insert({ name }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
