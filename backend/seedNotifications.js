const { pool } = require('./db');

const DEFAULT_NOTIFICATIONS = [
  { event_type: 'New ticket created',                        enabled: true  },
  { event_type: 'Ticket assigned to me',                     enabled: true  },
  { event_type: 'Ticket status changed',                     enabled: true  },
  { event_type: 'Ticket overdue reminder',                   enabled: false },
  { event_type: 'Ticket resolved',                           enabled: false },
  { event_type: 'New agent joined workspace',                enabled: false },
  { event_type: 'Agent goes offline',                        enabled: true  },
  { event_type: 'Send confirmation email on ticket create',  enabled: true  },
  { event_type: 'Send resolution email to customer',         enabled: true  },
  { event_type: 'Customer satisfaction survey after resolve', enabled: false },
];

async function seedNotifications() {
  try {
    for (const { event_type, enabled } of DEFAULT_NOTIFICATIONS) {
      await pool.query(
        `INSERT INTO email_notifications (event_type, enabled)
         VALUES ($1, $2)
         ON CONFLICT (event_type) DO NOTHING`,
        [event_type, enabled]
      );
    }
    const { rows } = await pool.query('SELECT * FROM email_notifications ORDER BY id');
    console.log(`✅ Done. ${rows.length} notification record(s) in DB:`);
    rows.forEach(r => console.log(`  [${r.id}] ${r.event_type} → ${r.enabled}`));
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seedNotifications();
