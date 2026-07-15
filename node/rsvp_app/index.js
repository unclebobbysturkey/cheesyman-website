const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const INVITE_CODE    = process.env.INVITE_CODE;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

app.use(cors());
app.use(express.json());

// POST /rsvp_api/verify-code — validate invite code
app.post('/rsvp_api/verify-code', (req, res) => {
  const { code } = req.body;
  if (!code || code.trim().toUpperCase() !== INVITE_CODE.toUpperCase()) {
    return res.status(401).json({ valid: false });
  }
  res.json({ valid: true });
});

// POST /rsvp_api/rsvp — submit an RSVP
app.post('/rsvp_api/rsvp', async (req, res) => {
  const { name, email, phone, adult_count, child_count, attending } = req.body;

  if (!name || typeof attending !== 'boolean') {
    return res.status(400).json({ error: 'Name and attending status are required.' });
  }

  if (attending && (!adult_count || adult_count < 1)) {
    return res.status(400).json({ error: 'Adult count is required when attending.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO rsvps (name, email, phone, adult_count, child_count, attending, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id`,
      [name, email || null, phone || null,
       attending ? adult_count : 0,
       attending ? (child_count || 0) : 0,
       attending]
    );
    res.status(201).json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('RSVP insert error:', err);
    res.status(500).json({ error: 'Failed to save RSVP.' });
  }
});

// GET /rsvp_api/admin — fetch all RSVPs (password protected)
app.get('/rsvp_api/admin', async (req, res) => {
  const { password } = req.query;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, adult_count, child_count, attending, created_at
       FROM rsvps
       ORDER BY created_at DESC`
    );

    const attending = result.rows.filter(r => r.attending);
    const declined = result.rows.filter(r => !r.attending);
    const totalGuests = attending.reduce((sum, r) => sum + (r.adult_count || 0) + (r.child_count || 0), 0);

    res.json({
      total_rsvps: result.rows.length,
      total_attending: attending.length,
      total_declined: declined.length,
      total_guests: totalGuests,
      rsvps: result.rows,
    });
  } catch (err) {
    console.error('Admin fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch RSVPs.' });
  }
});

app.listen(PORT, () => {
  console.log(`rsvp_app running on port ${PORT}`);
});
