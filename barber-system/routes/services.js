const express = require('express');
const router = express.Router();
const { supabase } = require('../db');

// GET all active services, grouped
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('active', true)
    .order('type')
    .order('category')
    .order('price');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT update service price (admin only)
router.put('/:id', async (req, res) => {
  if (!req.session.adminId) return res.status(401).json({ error: 'Unauthorized' });
  const { price, active } = req.body;
  const updates = {};
  if (price !== undefined) updates.price = price;
  if (active !== undefined) updates.active = active;
  const { error } = await supabase.from('services').update(updates).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// POST new service (admin only)
router.post('/', async (req, res) => {
  if (!req.session.adminId) return res.status(401).json({ error: 'Unauthorized' });
  const { name, category, price, type } = req.body;
  const { data, error } = await supabase
    .from('services')
    .insert({ name, category, price, type: type || 'haircut' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id: data.id });
});

module.exports = router;
