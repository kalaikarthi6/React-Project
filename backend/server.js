const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { pool, defaultDate, init, getUserByName, getGroupByName } = require('./db');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const port = process.env.PORT || 4000;

function mapTicket(row) {
  if (!row) return null;
  return {
    id: row.id,
    subject: row.subject,
    requester: row.requester_name,
    requester_email: row.requester_email,
    assignedTo: row.assigned_to_name,
    status: row.status,
    priority: row.priority,
    source: row.source,
    type: row.type,
    group: row.group_name,
    dept: row.dept,
    description: row.description,
    created: row.created_at,
    modified: row.updated_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapListing(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    category: row.category,
    status: row.status,
    vendor: row.vendor,
    cost: row.cost,
    department: row.department,
    assignedTo: row.assigned_to_name,
    expiry: row.expiry,
    description: row.description,
    created: row.created_at,
    created_at: row.created_at
  };
}

function mapWorkflow(row) {
  if (!row) return null;
  const conditions = row.conditions;
  const actions = row.actions;
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    trigger_event: row.trigger_event,
    conditions: Array.isArray(conditions) ? conditions : (conditions ? JSON.parse(conditions) : []),
    actions: Array.isArray(actions) ? actions : (actions ? JSON.parse(actions) : []),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    event_type: row.event_type,
    enabled: Boolean(row.enabled),
    created_at: row.created_at
  };
}

app.get('/api/tickets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, r.name AS requester_name, r.email AS requester_email,
        a.name AS assigned_to_name, g.name AS group_name
      FROM tickets t
      LEFT JOIN users r ON t.requester_id = r.id
      LEFT JOIN users a ON t.assigned_to_id = a.id
      LEFT JOIN groups g ON t.group_id = g.id
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows.map(mapTicket));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/tickets/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, r.name AS requester_name, r.email AS requester_email,
        a.name AS assigned_to_name, g.name AS group_name
      FROM tickets t
      LEFT JOIN users r ON t.requester_id = r.id
      LEFT JOIN users a ON t.assigned_to_id = a.id
      LEFT JOIN groups g ON t.group_id = g.id
      WHERE t.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(mapTicket(result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/tickets', async (req, res) => {
  try {
    const payload = req.body || {};
    const requester = await getUserByName(payload.requester);
    const assigned = await getUserByName(payload.assignedTo);
    const group = await getGroupByName(payload.group);
    const now = defaultDate();
    const insert = await pool.query(
      `INSERT INTO tickets (subject, requester_id, assigned_to_id, status, priority, source, type, group_id, dept, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        payload.subject || 'No subject',
        requester?.id || null,
        assigned?.id || null,
        payload.status || 'Open',
        payload.priority || 'Low',
        payload.source || null,
        payload.type || null,
        group?.id || null,
        payload.dept || null,
        payload.description || null,
        payload.created_at || now,
        payload.updated_at || now
      ]
    );
    const created = await pool.query(`
      SELECT t.*, r.name AS requester_name, r.email AS requester_email, a.name AS assigned_to_name, g.name AS group_name
      FROM tickets t
      LEFT JOIN users r ON t.requester_id = r.id
      LEFT JOIN users a ON t.assigned_to_id = a.id
      LEFT JOIN groups g ON t.group_id = g.id
      WHERE t.id = $1
    `, [insert.rows[0].id]);
    res.status(201).json(mapTicket(created.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/tickets/:id', async (req, res) => {
  try {
    const payload = req.body || {};
    const ticketRes = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    const ticket = ticketRes.rows[0];
    if (!ticket) return res.status(404).json({ error: 'Not found' });
    const requester = await getUserByName(payload.requester);
    const assigned = await getUserByName(payload.assignedTo);
    const group = await getGroupByName(payload.group);
    const now = defaultDate();
    await pool.query(
      `UPDATE tickets SET subject = $1, requester_id = $2, assigned_to_id = $3, status = $4, priority = $5, source = $6, type = $7, group_id = $8, dept = $9, description = $10, updated_at = $11 WHERE id = $12`,
      [
        payload.subject || ticket.subject,
        requester?.id || ticket.requester_id,
        assigned?.id || ticket.assigned_to_id,
        payload.status || ticket.status,
        payload.priority || ticket.priority,
        payload.source || ticket.source,
        payload.type || ticket.type,
        group?.id || ticket.group_id,
        payload.dept || ticket.dept,
        payload.description || ticket.description,
        now,
        ticket.id
      ]
    );
    const updated = await pool.query(`
      SELECT t.*, r.name AS requester_name, r.email AS requester_email, a.name AS assigned_to_name, g.name AS group_name
      FROM tickets t
      LEFT JOIN users r ON t.requester_id = r.id
      LEFT JOIN users a ON t.assigned_to_id = a.id
      LEFT JOIN groups g ON t.group_id = g.id
      WHERE t.id = $1
    `, [ticket.id]);
    res.json(mapTicket(updated.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/tickets/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM tickets WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY name');
    res.json(result.rows.map(row => ({ ...row, created_at: row.created_at })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const payload = req.body || {};
    const now = defaultDate();
    const insert = await pool.query(
      'INSERT INTO users (name, email, role, status, avatar, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [payload.name || 'Unknown', payload.email || '', payload.role || 'Agent', payload.status || 'Active', payload.avatar || null, now]
    );
    res.status(201).json(insert.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const payload = req.body || {};
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'Not found' });
    const updated = await pool.query(
      'UPDATE users SET name = $1, email = $2, role = $3, status = $4, avatar = $5 WHERE id = $6 RETURNING *',
      [payload.name || user.name, payload.email || user.email, payload.role || user.role, payload.status || user.status, payload.avatar || user.avatar, user.id]
    );
    res.json(updated.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/groups', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM groups ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/groups', async (req, res) => {
  try {
    const payload = req.body || {};
    const now = defaultDate();
    const result = await pool.query(
      'INSERT INTO groups (name, description, created_at) VALUES ($1, $2, $3) RETURNING *',
      [payload.name || 'Unnamed group', payload.description || null, now]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/groups/:id', async (req, res) => {
  try {
    const payload = req.body || {};
    const groupRes = await pool.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
    const group = groupRes.rows[0];
    if (!group) return res.status(404).json({ error: 'Not found' });
    const updated = await pool.query(
      'UPDATE groups SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [payload.name || group.name, payload.description || group.description, group.id]
    );
    res.json(updated.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/groups/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM groups WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/listings', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, u.name AS assigned_to_name
      FROM listings l
      LEFT JOIN users u ON l.assigned_to_id = u.id
      ORDER BY l.created_at DESC
    `);
    res.json(result.rows.map(mapListing));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/listings', async (req, res) => {
  try {
    const payload = req.body || {};
    const assigned = await getUserByName(payload.assignedTo);
    const now = defaultDate();
    const result = await pool.query(
      `INSERT INTO listings (name, type, category, status, vendor, cost, department, assigned_to_id, expiry, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        payload.name || 'Unnamed listing',
        payload.type || null,
        payload.category || null,
        payload.status || null,
        payload.vendor || null,
        payload.cost || null,
        payload.department || null,
        assigned?.id || null,
        payload.expiry || null,
        payload.description || null,
        payload.created_at || now
      ]
    );
    res.status(201).json(mapListing(result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/listings/:id', async (req, res) => {
  try {
    const payload = req.body || {};
    const listingRes = await pool.query('SELECT * FROM listings WHERE id = $1', [req.params.id]);
    const listing = listingRes.rows[0];
    if (!listing) return res.status(404).json({ error: 'Not found' });
    const assigned = await getUserByName(payload.assignedTo);
    const updated = await pool.query(
      `UPDATE listings SET name = $1, type = $2, category = $3, status = $4, vendor = $5, cost = $6, department = $7, assigned_to_id = $8, expiry = $9, description = $10 WHERE id = $11 RETURNING *`,
      [
        payload.name || listing.name,
        payload.type || listing.type,
        payload.category || listing.category,
        payload.status || listing.status,
        payload.vendor || listing.vendor,
        payload.cost || listing.cost,
        payload.department || listing.department,
        assigned?.id || listing.assigned_to_id,
        payload.expiry || listing.expiry,
        payload.description || listing.description,
        listing.id
      ]
    );
    res.json(mapListing(updated.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/listings/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM listings WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/sla-policies', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sla_policies ORDER BY id');
    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      priority: row.priority,
      first_response_hours: row.first_response_hours,
      resolution_hours: row.resolution_hours,
      created_at: row.created_at
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/sla-policies', async (req, res) => {
  try {
    const payload = req.body || {};
    const now = defaultDate();
    const result = await pool.query(
      'INSERT INTO sla_policies (name, priority, first_response_hours, resolution_hours, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [payload.name || 'New policy', payload.priority || 'Medium', payload.first_response_hours || 0, payload.resolution_hours || 0, now]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/sla-policies/:id', async (req, res) => {
  try {
    const payload = req.body || {};
    const policyRes = await pool.query('SELECT * FROM sla_policies WHERE id = $1', [req.params.id]);
    const policy = policyRes.rows[0];
    if (!policy) return res.status(404).json({ error: 'Not found' });
    const updated = await pool.query(
      'UPDATE sla_policies SET name = $1, priority = $2, first_response_hours = $3, resolution_hours = $4 WHERE id = $5 RETURNING *',
      [payload.name || policy.name, payload.priority || policy.priority, payload.first_response_hours || policy.first_response_hours, payload.resolution_hours || policy.resolution_hours, policy.id]
    );
    res.json(updated.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/sla-policies/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM sla_policies WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/workflow-automator', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM workflow_automator ORDER BY created_at DESC');
    res.json(result.rows.map(mapWorkflow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/workflow-automator', async (req, res) => {
  try {
    const payload = req.body || {};
    const now = defaultDate();
    const result = await pool.query(
      'INSERT INTO workflow_automator (name, status, trigger_event, conditions, actions, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [
        payload.name || 'New workflow',
        payload.status || 'Inactive',
        payload.trigger_event || null,
        JSON.stringify(payload.conditions || []),
        JSON.stringify(payload.actions || []),
        payload.created_at || now,
        payload.updated_at || now
      ]
    );
    res.status(201).json(mapWorkflow(result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/workflow-automator/:id', async (req, res) => {
  try {
    const payload = req.body || {};
    const workflowRes = await pool.query('SELECT * FROM workflow_automator WHERE id = $1', [req.params.id]);
    const workflow = workflowRes.rows[0];
    if (!workflow) return res.status(404).json({ error: 'Not found' });
    const conditionsValue = payload.conditions !== undefined ? payload.conditions : (workflow.conditions || []);
    const actionsValue = payload.actions !== undefined ? payload.actions : (workflow.actions || []);
    const now = defaultDate();
    const updated = await pool.query(
      'UPDATE workflow_automator SET name = $1, status = $2, trigger_event = $3, conditions = $4, actions = $5, updated_at = $6 WHERE id = $7 RETURNING *',
      [
        payload.name || workflow.name,
        payload.status || workflow.status,
        payload.trigger_event || workflow.trigger_event,
        JSON.stringify(conditionsValue),
        JSON.stringify(actionsValue),
        now,
        workflow.id
      ]
    );
    res.json(mapWorkflow(updated.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/workflow-automator/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM workflow_automator WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/email-notifications', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM email_notifications ORDER BY id');
    res.json(result.rows.map(mapNotification));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/email-notifications/:id', async (req, res) => {
  try {
    const notificationRes = await pool.query('SELECT * FROM email_notifications WHERE id = $1', [req.params.id]);
    const notification = notificationRes.rows[0];
    if (!notification) return res.status(404).json({ error: 'Not found' });
    const enabled = req.body.enabled === true;
    const updated = await pool.query('UPDATE email_notifications SET enabled = $1 WHERE id = $2 RETURNING *', [enabled, notification.id]);
    res.json(mapNotification(updated.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/workspace-settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM workspace_settings ORDER BY id LIMIT 1');
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({
      id: row.id,
      workspace_name: row.workspace_name,
      url: row.url,
      timezone: row.timezone,
      language: row.language,
      date_format: row.date_format,
      created_at: row.created_at
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/workspace-settings/:id', async (req, res) => {
  try {
    const settingRes = await pool.query('SELECT * FROM workspace_settings WHERE id = $1', [req.params.id]);
    const setting = settingRes.rows[0];
    if (!setting) return res.status(404).json({ error: 'Not found' });
    const payload = req.body || {};
    const updated = await pool.query(
      'UPDATE workspace_settings SET workspace_name = $1, url = $2, timezone = $3, language = $4, date_format = $5 WHERE id = $6 RETURNING *',
      [
        payload.workspace_name || setting.workspace_name,
        payload.url || setting.url,
        payload.timezone || setting.timezone,
        payload.language || setting.language,
        payload.date_format || setting.date_format,
        setting.id
      ]
    );
    const row = updated.rows[0];
    res.json({
      id: row.id,
      workspace_name: row.workspace_name,
      url: row.url,
      timezone: row.timezone,
      language: row.language,
      date_format: row.date_format,
      created_at: row.created_at
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

init()
  .then(() => {
    app.listen(port, () => {
      console.log(`CERTIS API server listening on http://localhost:${port}`);
    });
  })
  .catch(err => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
