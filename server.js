// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');
const multer = require('multer');
const xlsx = require('xlsx');

// ⚙️ Configuration
const PORT = process.env.PORT || 3006;
const db = new sqlite3.Database('./EM4.db', (err) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Connected to SQLite database successfully.');
    }
});

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Main route to render the dashboard
app.get('/', (req, res) => {
    res.render('dashboard');
});

// New route to render the data entry page (optional)
app.get('/add-event', (req, res) => {
    res.render('add-event');
});

/* ======================== ALERT HELPERS ======================== */

/** Evaluate a rule right now against latest event and set TriggeredAlerts accordingly */
const evaluateRule = (alertId, cb) => {
    db.get(`SELECT * FROM AlertRules WHERE AlertID = ?`, [alertId], (err, rule) => {
        if (err) return cb(err);
        if (!rule) return cb(null); // nothing to do

        // latest event for that meter
        db.get(
            `SELECT Timestamp, AvgCurrent, AvgVoltage, AvgPowerFactor, Total_KW, Total_KWH
             FROM Events
             WHERE MeterID = ?
             ORDER BY Timestamp DESC LIMIT 1`,
            [rule.MeterID],
            (err2, live) => {
                if (err2) return cb(err2);

                const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
                const value = live ? live[rule.Parameter] : null;
                const conditionTrue = value != null && Number(value) > Number(rule.Threshold);

                if (conditionTrue && rule.IsActive === 1) {
                    // ensure one active row per rule (idempotent)
                    db.get(
                        `SELECT TriggeredID FROM TriggeredAlerts WHERE AlertID = ? AND IsActive = 1`,
                        [rule.AlertID],
                        (e3, row) => {
                            if (e3) return cb(e3);
                            if (row) return cb(null); // already active
                            db.run(
                                `INSERT INTO TriggeredAlerts (AlertID, MeterID, StartTime, Message, IsActive)
                                 VALUES (?, ?, ?, ?, 1)`,
                                [rule.AlertID, rule.MeterID, now, rule.Message],
                                cb
                            );
                        }
                    );
                } else {
                    // condition false OR rule inactive → recover any active row
                    db.run(
                        `UPDATE TriggeredAlerts
                         SET EndTime = ?, IsActive = 0
                         WHERE AlertID = ? AND IsActive = 1`,
                        [now, rule.AlertID],
                        cb
                    );
                }
            }
        );
    });
};

/** Periodically check all active rules for new triggers or recoveries */
const pollAlerts = () => {
    db.all(`SELECT AlertID FROM AlertRules WHERE IsActive = 1`, [], (err, rows) => {
        if (err) return console.error('Error polling alerts:', err.message);
        rows.forEach(row => {
            evaluateRule(row.AlertID, (e) => {
                if (e) console.error(`Error evaluating rule ${row.AlertID}:`, e.message);
            });
        });
    });
};

// Start the polling mechanism
setInterval(pollAlerts, 10000); // Poll every 10 seconds

/* ========================= ALERT ROUTES ========================= */

// GET /api/alerts/rules - Get all alert rules
app.get('/api/alerts/rules', (req, res) => {
    db.all('SELECT * FROM AlertRules', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/alerts/rules - Create a new alert rule (then evaluate immediately)
app.post('/api/alerts/rules', (req, res) => {
    const { MeterID, Parameter, Threshold, Message } = req.body;
    db.run(
        'INSERT INTO AlertRules (MeterID, Parameter, Threshold, Message) VALUES (?, ?, ?, ?)',
        [MeterID, Parameter, Threshold, Message],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            const newId = this.lastID;
            evaluateRule(newId, (e2) => {
                if (e2) return res.status(500).json({ error: e2.message });
                res.status(201).json({ message: 'Alert rule added successfully', alertId: newId });
            });
        }
    );
});

// PUT /api/alerts/rules/:id - Update a rule in place (and evaluate immediately)
app.put('/api/alerts/rules/:id', (req, res) => {
    const { id } = req.params;
    const { MeterID, Parameter, Threshold, Message, IsActive } = req.body;

    db.run(
        `UPDATE AlertRules
         SET MeterID = COALESCE(?, MeterID),
             Parameter = COALESCE(?, Parameter),
             Threshold = COALESCE(?, Threshold),
             Message = COALESCE(?, Message),
             IsActive = COALESCE(?, IsActive)
         WHERE AlertID = ?`,
        [MeterID, Parameter, Threshold, Message, IsActive, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // Re-evaluate this rule so active flag flips appropriately
            evaluateRule(id, (e2) => {
                if (e2) return res.status(500).json({ error: e2.message });
                res.json({ message: 'Alert rule updated and evaluated' });
            });
        }
    );
});

// DELETE /api/alerts/rules/:id - Delete an alert rule (recover any active trigger first)
app.delete('/api/alerts/rules/:id', (req, res) => {
    const { id } = req.params;
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');

    db.run(
        `UPDATE TriggeredAlerts SET EndTime = ?, IsActive = 0
         WHERE AlertID = ? AND IsActive = 1`,
        [now, id],
        function (e1) {
            if (e1) return res.status(500).json({ error: e1.message });
            db.run('DELETE FROM AlertRules WHERE AlertID = ?', id, function (e2) {
                if (e2) return res.status(500).json({ error: e2.message });
                res.json({ message: 'Alert rule deleted (and any active trigger recovered)' });
            });
        }
    );
});

// GET /api/alerts/triggered - Get all triggered alerts (only active ones)
app.get('/api/alerts/triggered', (req, res) => {
    db.all(
        'SELECT * FROM TriggeredAlerts WHERE IsActive = 1 ORDER BY StartTime DESC',
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// POST /api/alerts/triggered - Add a new triggered alert (idempotent)
app.post('/api/alerts/triggered', (req, res) => {
    const { AlertID, MeterID, Message } = req.body;
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');

    // Avoid duplicates: if already active, return that
    db.get(
        `SELECT TriggeredID FROM TriggeredAlerts WHERE AlertID = ? AND IsActive = 1`,
        [AlertID],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row) return res.json({ message: 'Alert already active', triggeredId: row.TriggeredID });

            db.run(
                `INSERT INTO TriggeredAlerts (AlertID, MeterID, StartTime, Message, IsActive)
                 VALUES (?, ?, ?, ?, 1)`,
                [AlertID, MeterID, now, Message],
                function (err2) {
                    if (err2) return res.status(500).json({ error: err2.message });
                    res.status(201).json({ message: 'Alert triggered successfully', triggeredId: this.lastID });
                }
            );
        }
    );
});

// PUT /api/alerts/triggered/recover/:alertId - Mark an alert as recovered
app.put('/api/alerts/triggered/recover/:alertId', (req, res) => {
    const { alertId } = req.params;
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    db.run(
        'UPDATE TriggeredAlerts SET EndTime = ?, IsActive = 0 WHERE AlertID = ? AND IsActive = 1',
        [now, alertId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Alert recovered successfully' });
        }
    );
});

/* ========================= EXISTING APIs ========================= */

// GET /api/meters
app.get('/api/meters', (req, res) => {
    db.all(
        'SELECT MeterID, Location, Description, InstallationDate FROM Meters',
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// GET /api/live-data/:meterId
app.get('/api/live-data/:meterId', (req, res) => {
    const { meterId } = req.params;
    // include Total_KW so rules using it can be evaluated on the client
    db.get(
        'SELECT MeterID, Timestamp, AvgCurrent, AvgVoltage, AvgPowerFactor, Total_KW, Total_KWH FROM Events WHERE MeterID = ? ORDER BY Timestamp DESC LIMIT 1',
        [meterId],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(row || null);
        }
    );
});

// GET /api/historical-data/:meterId
app.get('/api/historical-data/:meterId', (req, res) => {
    const { meterId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate
        ? moment(startDate).utc().format('YYYY-MM-DD HH:mm:ss')
        : moment().utc().subtract(24, 'hours').format('YYYY-MM-DD HH:mm:ss');
    const end = endDate
        ? moment(endDate).utc().format('YYYY-MM-DD HH:mm:ss')
        : moment().utc().format('YYYY-MM-DD HH:mm:ss');

    db.all(
        `SELECT Timestamp, PowerFactor_L1, PowerFactor_L2, PowerFactor_L3, AvgPowerFactor,
                 Current_L1, Current_L2, Current_L3, AvgCurrent
           FROM Events
          WHERE MeterID = ? AND Timestamp BETWEEN ? AND ?
         ORDER BY Timestamp ASC`,
        [meterId, start, end],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// GET /api/events
app.get('/api/events', (req, res) => {
    const { meterId, startDate, endDate } = req.query;

    const start = startDate
        ? moment(startDate).utc().format('YYYY-MM-DD HH:mm:ss')
        : moment().utc().subtract(24, 'hours').format('YYYY-MM-DD HH:mm:ss');
    const end = endDate
        ? moment(endDate).utc().format('YYYY-MM-DD HH:mm:ss')
        : moment().utc().format('YYYY-MM-DD HH:mm:ss');

    let query = `SELECT * FROM Events WHERE Timestamp BETWEEN ? AND ?`;
    const params = [start, end];

    if (meterId) {
        query += ` AND MeterID = ?`;
        params.push(meterId);
    }

    db.all(query + ` ORDER BY Timestamp DESC`, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET /api/total-kwh-latest
app.get('/api/total-kwh-latest', (req, res) => {
    const query = `
      SELECT T1.MeterID, T1.Total_KWH, T2.Location
        FROM Events AS T1
        INNER JOIN (
          SELECT MeterID, MAX(Timestamp) AS MaxTimestamp
            FROM Events
           GROUP BY MeterID
        ) AS T3
          ON T1.MeterID = T3.MeterID AND T1.Timestamp = T3.MaxTimestamp
        JOIN Meters AS T2 ON T1.MeterID = T2.MeterID
    ORDER BY T1.MeterID ASC;`;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


// New route to render the data entry page
app.get('/add-event', (req, res) => {
    res.render('add-event');
});

// === NEW API ROUTES FOR DATA ENTRY ===

// POST /api/add-event - Add a single new event
// NEW API route to get the single latest event from the entire Events table
// POST /api/add-event - Add a single new event
app.post('/api/add-event', (req, res) => {
    const { MeterID, Timestamp, Current_L1, Current_L2, Current_L3, Voltage_L1, Voltage_L2, Voltage_L3, PowerFactor_L1, PowerFactor_L2, PowerFactor_L3, AvgCurrent, AvgVoltage, AvgPowerFactor, Total_KW, Total_KWH } = req.body;
    
    // Convert local Timestamp to UTC for storage
    const timestampUTC = moment(Timestamp).utc().format('YYYY-MM-DD HH:mm:ss');

    if (!MeterID || !Timestamp) {
        return res.status(400).json({ error: 'MeterID and Timestamp are required.' });
    }

    const query = `
        INSERT INTO Events (
            MeterID, Timestamp, Current_L1, Current_L2, Current_L3, 
            Voltage_L1, Voltage_L2, Voltage_L3, PowerFactor_L1, 
            PowerFactor_L2, PowerFactor_L3, AvgCurrent, AvgVoltage, 
            AvgPowerFactor, Total_KW, Total_KWH
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
        MeterID, timestampUTC, Current_L1, Current_L2, Current_L3, 
        Voltage_L1, Voltage_L2, Voltage_L3, PowerFactor_L1, 
        PowerFactor_L2, PowerFactor_L3, AvgCurrent, AvgVoltage, 
        AvgPowerFactor, Total_KW, Total_KWH
    ];
    
    db.run(query, params, function(err) {
        if (err) {
            console.error('Failed to insert new event:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'Event added successfully!', eventId: this.lastID });
    });
});

// API route to update all meters with a new event at the current time
app.post('/api/add-latest-events', (req, res) => {
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    const query = `
        INSERT INTO Events (
            MeterID, Timestamp, Current_L1, Current_L2, Current_L3, 
            Voltage_L1, Voltage_L2, Voltage_L3, PowerFactor_L1, 
            PowerFactor_L2, PowerFactor_L3, AvgCurrent, AvgVoltage, 
            AvgPowerFactor, Total_KW, Total_KWH
        ) 
        SELECT
            T1.MeterID, ?, T1.Current_L1, T1.Current_L2, T1.Current_L3,
            T1.Voltage_L1, T1.Voltage_L2, T1.Voltage_L3, T1.PowerFactor_L1,
            T1.PowerFactor_L2, T1.PowerFactor_L3, T1.AvgCurrent, T1.AvgVoltage,
            T1.AvgPowerFactor, T1.Total_KW, T1.Total_KWH
        FROM Events AS T1
        INNER JOIN (
            SELECT MeterID, MAX(Timestamp) AS MaxTimestamp
            FROM Events
            GROUP BY MeterID
        ) AS T3 ON T1.MeterID = T3.MeterID AND T1.Timestamp = T3.MaxTimestamp;
    `;
    db.run(query, [now], function(err) {
        if (err) {
            console.error('Failed to update all events:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: `New events added for all meters at ${now}` });
    });
});

// API route to download an Excel template
app.get('/api/events/download', (req, res) => {
    const query = `
        SELECT T1.*
        FROM Events AS T1
        INNER JOIN (
            SELECT MeterID, MAX(Timestamp) AS MaxTimestamp
            FROM Events
            GROUP BY MeterID
        ) AS T3 ON T1.MeterID = T3.MeterID AND T1.Timestamp = T3.MaxTimestamp
        JOIN Meters AS T2 ON T1.MeterID = T2.MeterID
        ORDER BY T1.MeterID ASC;
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const worksheet = xlsx.utils.json_to_sheet(rows);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Events Data");

        const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Events_Template.xlsx');
        res.end(buffer);
    });
});

// API route to upload an Excel file
app.post('/api/events/upload', upload.single('excelFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        db.serialize(() => {
            db.run('BEGIN TRANSACTION;');
            const stmt = db.prepare(`
                INSERT INTO Events (
                    EventID, MeterID, Timestamp, Current_L1, Current_L2, Current_L3, 
                    Voltage_L1, Voltage_L2, Voltage_L3, PowerFactor_L1, 
                    PowerFactor_L2, PowerFactor_L3, AvgCurrent, AvgVoltage, 
                    AvgPowerFactor, Total_KW, Total_KWH
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            data.forEach(row => {
                const params = [
                    row.EventID, row.MeterID, moment(row.Timestamp).utc().format('YYYY-MM-DD HH:mm:ss'), row.Current_L1, row.Current_L2, row.Current_L3,
                    row.Voltage_L1, row.Voltage_L2, row.Voltage_L3, row.PowerFactor_L1,
                    row.PowerFactor_L2, row.PowerFactor_L3, row.AvgCurrent, row.AvgVoltage,
                    row.AvgPowerFactor, row.Total_KW, row.Total_KWH
                ];
                stmt.run(params);
            });
            stmt.finalize();
            db.run('COMMIT;', (err) => {
                if (err) {
                    console.error('Commit failed:', err.message);
                    return res.status(500).json({ error: 'Failed to commit transaction.' });
                }
                res.status(200).json({ message: `${data.length} events imported successfully!` });
            });
        });
    } catch (error) {
        console.error('Failed to process Excel file:', error);
        res.status(500).json({ error: 'Failed to process Excel file.' });
    }
});



app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});