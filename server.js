// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');

// ⚙️ Configuration
const PORT = process.env.PORT || 3006;
const db = new sqlite3.Database('./EM4.db', (err) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Connected to SQLite database successfully.');
    }
});

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // Middleware to parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Middleware to parse URL-encoded bodies
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

// New API route to add a new event
app.post('/api/add-event', (req, res) => {
    const { MeterID, Timestamp, Current_L1, Current_L2, Current_L3, Voltage_L1, Voltage_L2, Voltage_L3, PowerFactor_L1, PowerFactor_L2, PowerFactor_L3, AvgCurrent, AvgVoltage, AvgPowerFactor, Total_KW, Total_KWH } = req.body;
    
    // Ensure all data is present
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
        MeterID, Timestamp, Current_L1, Current_L2, Current_L3, 
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

// Existing API routes from your dashboard
// --------------------------------------------------------------------------------------------------------------------

/**
 * GET /api/meters
 */
app.get('/api/meters', (req, res) => {
    db.all('SELECT MeterID, Location, Description, InstallationDate FROM Meters', [], (err, rows) => {
        if (err) {
            console.error('API Error: /api/meters', err);
            res.status(500).json({ error: 'Failed to retrieve meters.' });
        } else {
            res.json(rows);
        }
    });
});

/**
 * GET /api/live-data/:meterId
 */
app.get('/api/live-data/:meterId', (req, res) => {
    const { meterId } = req.params;
    db.get('SELECT MeterID, Timestamp, AvgCurrent, AvgVoltage, AvgPowerFactor, Total_KWH FROM Events WHERE MeterID = ? ORDER BY Timestamp DESC LIMIT 1', [meterId], (err, row) => {
        if (err) {
            console.error(`API Error: /api/live-data/${meterId}`, err);
            res.status(500).json({ error: 'Failed to retrieve live data.' });
        } else {
            res.json(row || null);
        }
    });
});

/**
 * GET /api/historical-data/:meterId
 */
app.get('/api/historical-data/:meterId', (req, res) => {
    const { meterId } = req.params;
    const { startDate, endDate } = req.query;
    
    const start = startDate ? moment(startDate).format('YYYY-MM-DD HH:mm:ss') : moment().subtract(24, 'hours').format('YYYY-MM-DD HH:mm:ss');
    const end = endDate ? moment(endDate).format('YYYY-MM-DD HH:mm:ss') : moment().format('YYYY-MM-DD HH:mm:ss');

    db.all('SELECT Timestamp, PowerFactor_L1, PowerFactor_L2, PowerFactor_L3, AvgPowerFactor, Current_L1, Current_L2, Current_L3, AvgCurrent FROM Events WHERE MeterID = ? AND Timestamp BETWEEN ? AND ? ORDER BY Timestamp ASC', [meterId, start, end], (err, rows) => {
        if (err) {
            console.error(`API Error: /api/historical-data/${meterId}`, err);
            res.status(500).json({ error: 'Failed to retrieve historical data.' });
        } else {
            res.json(rows);
        }
    });
});

/**
 * GET /api/events
 */
app.get('/api/events', (req, res) => {
    const { meterId, startDate, endDate } = req.query;

    const start = startDate ? moment(startDate).format('YYYY-MM-DD HH:mm:ss') : moment().subtract(24, 'hours').format('YYYY-MM-DD HH:mm:ss');
    const end = endDate ? moment(endDate).format('YYYY-MM-DD HH:mm:ss') : moment().format('YYYY-MM-DD HH:mm:ss');
    
    let query = `SELECT * FROM Events WHERE Timestamp BETWEEN ? AND ?`;
    let params = [start, end];

    if (meterId) {
        query += ` AND MeterID = ?`;
        params.push(meterId);
    }
    
    db.all(query + ` ORDER BY Timestamp DESC`, params, (err, rows) => {
        if (err) {
            console.error('API Error: /api/events', err);
            res.status(500).json({ error: 'Failed to retrieve events.' });
        } else {
            res.json(rows);
        }
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
        if (err) {
            console.error('API Error: /api/total-kwh-latest', err);
            res.status(500).json({ error: 'Failed to retrieve latest KWH data.' });
        } else {
            res.json(rows);
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});