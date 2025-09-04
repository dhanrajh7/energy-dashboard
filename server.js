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

// New route to render the data entry page
app.get('/add-event', (req, res) => {
    res.render('add-event');
});

// === API ROUTES FOR ALERTS ===

// GET /api/alerts/rules - Get all alert rules
app.get('/api/alerts/rules', (req, res) => {
    db.all('SELECT * FROM AlertRules', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/alerts/rules - Create a new alert rule
app.post('/api/alerts/rules', (req, res) => {
    const { MeterID, Parameter, Threshold, Message } = req.body;
    db.run('INSERT INTO AlertRules (MeterID, Parameter, Threshold, Message) VALUES (?, ?, ?, ?)', 
        [MeterID, Parameter, Threshold, Message], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Alert rule added successfully', alertId: this.lastID });
    });
});

// DELETE /api/alerts/rules/:id - Delete an alert rule
app.delete('/api/alerts/rules/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM AlertRules WHERE AlertID = ?', id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Alert rule deleted successfully' });
    });
});

// GET /api/alerts/triggered - Get all triggered alerts
app.get('/api/alerts/triggered', (req, res) => {
    db.all('SELECT * FROM TriggeredAlerts ORDER BY Timestamp DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/alerts/triggered - Add a new triggered alert
app.post('/api/alerts/triggered', (req, res) => {
    const { AlertID, MeterID, Message } = req.body;
    const now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
    db.run('INSERT INTO TriggeredAlerts (AlertID, MeterID, Timestamp, Message) VALUES (?, ?, ?, ?)', 
        [AlertID, MeterID, now, Message], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Alert triggered successfully', triggeredId: this.lastID });
    });
});

// DELETE /api/alerts/triggered - Clear all triggered alerts
app.delete('/api/alerts/triggered', (req, res) => {
    db.run('DELETE FROM TriggeredAlerts', [], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'All triggered alerts cleared successfully' });
    });
});


// === EXISTING API ROUTES ===
/**
 * GET /api/meters
 */
app.get('/api/meters', (req, res) => {
    db.all('SELECT MeterID, Location, Description, InstallationDate FROM Meters', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
/**
 * GET /api/live-data/:meterId
 */
app.get('/api/live-data/:meterId', (req, res) => {
    const { meterId } = req.params;
    db.get('SELECT MeterID, Timestamp, AvgCurrent, AvgVoltage, AvgPowerFactor, Total_KWH FROM Events WHERE MeterID = ? ORDER BY Timestamp DESC LIMIT 1', [meterId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || null);
    });
});
/**
 * GET /api/historical-data/:meterId
 */
app.get('/api/historical-data/:meterId', (req, res) => {
    const { meterId } = req.params;
    const { startDate, endDate } = req.query;
    
    const start = startDate ? moment(startDate).utc().format('YYYY-MM-DD HH:mm:ss') : moment().utc().subtract(24, 'hours').format('YYYY-MM-DD HH:mm:ss');
    const end = endDate ? moment(endDate).utc().format('YYYY-MM-DD HH:mm:ss') : moment().utc().format('YYYY-MM-DD HH:mm:ss');

    db.all('SELECT Timestamp, PowerFactor_L1, PowerFactor_L2, PowerFactor_L3, AvgPowerFactor, Current_L1, Current_L2, Current_L3, AvgCurrent FROM Events WHERE MeterID = ? AND Timestamp BETWEEN ? AND ? ORDER BY Timestamp ASC', [meterId, start, end], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
/**
 * GET /api/events
 */
app.get('/api/events', (req, res) => {
    const { meterId, startDate, endDate } = req.query;
    
    const start = startDate ? moment(startDate).utc().format('YYYY-MM-DD HH:mm:ss') : moment().utc().subtract(24, 'hours').format('YYYY-MM-DD HH:mm:ss');
    const end = endDate ? moment(endDate).utc().format('YYYY-MM-DD HH:mm:ss') : moment().utc().format('YYYY-MM-DD HH:mm:ss');
    
    let query = `SELECT * FROM Events WHERE Timestamp BETWEEN ? AND ?`;
    let params = [start, end];

    if (meterId) {
        query += ` AND MeterID = ?`;
        params.push(meterId);
    }
    
    db.all(query + ` ORDER BY Timestamp DESC`, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
/**
 * GET /api/total-kwh-latest
 */
app.get('/api/total-kwh-latest', (req, res) => {
    const query = `
        SELECT T1.MeterID, T1.Total_KWH, T2.Location
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
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});