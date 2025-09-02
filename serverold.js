// server.js
const express = require('express');
const mssql = require('mssql');
const path = require('path');
const moment = require('moment');

// ⚙️ Configuration
const PORT = process.env.PORT || 3006;
const sqlConfig = {
    user: 'test',
    password: 'test@1234',
    server: 'localhost', // or your SQL Server IP address
    database: 'EM4',
    options: {
        encrypt: true, // For Azure SQL or if using SSL/TLS
        trustServerCertificate: true // Trust self-signed certificates
    }
};

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Connect to the database
async function connectToDb() {
    try {
        await mssql.connect(sqlConfig);
        console.log('✅ Connected to SQL Server successfully.');
    } catch (err) {
        console.error('❌ Database connection failed: ', err);
    }
}
connectToDb();

// Main route to render the dashboard
app.get('/', (req, res) => {
    res.render('dashboard');
});

// API Routes
// --------------------------------------------------------------------------------------------------------------------

/**
 * GET /api/meters
 * Fetches all meters from the Meters table.
 */
app.get('/api/meters', async (req, res) => {
    try {
        const result = await mssql.query`SELECT MeterID, Location, Description, InstallationDate FROM Meters`;
        res.json(result.recordset);
    } catch (err) {
        console.error('API Error: /api/meters', err);
        res.status(500).json({ error: 'Failed to retrieve meters.' });
    }
});

/**
 * GET /api/live-data/:meterId
 * Fetches the latest event data for a specific meter.
 */
app.get('/api/live-data/:meterId', async (req, res) => {
    const { meterId } = req.params;
    try {
        const result = await mssql.query`
            SELECT TOP 1 
                MeterID, Timestamp, AvgCurrent, AvgVoltage, AvgPowerFactor, Total_KWH 
            FROM Events 
            WHERE MeterID = ${meterId} 
            ORDER BY Timestamp DESC
        `;
        res.json(result.recordset[0] || null);
    } catch (err) {
        console.error(`API Error: /api/live-data/${meterId}`, err);
        res.status(500).json({ error: 'Failed to retrieve live data.' });
    }
});

/**
 * GET /api/historical-data/:meterId
 * Fetches historical event data (Power Factor and Current) for a specific meter within a date range.
 * Default range is last 24 hours.
 */
app.get('/api/historical-data/:meterId', async (req, res) => {
    const { meterId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : moment().subtract(24, 'hours').toDate();
    const end = endDate ? new Date(endDate) : new Date();

    try {
        const result = await mssql.query`
            SELECT 
                Timestamp, 
                PowerFactor_L1, PowerFactor_L2, PowerFactor_L3, AvgPowerFactor, 
                Current_L1, Current_L2, Current_L3, AvgCurrent 
            FROM Events 
            WHERE MeterID = ${meterId} 
            AND Timestamp BETWEEN ${start} AND ${end}
            ORDER BY Timestamp ASC
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error(`API Error: /api/historical-data/${meterId}`, err);
        res.status(500).json({ error: 'Failed to retrieve historical data.' });
    }
});

/**
 * GET /api/events
 * Fetches all events with optional filters for MeterID and date range.
 * Default range is last 24 hours.
 */
app.get('/api/events', async (req, res) => {
    const { meterId, startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : moment().subtract(24, 'hours').toDate();
    const end = endDate ? new Date(endDate) : new Date();
    
    try {
        let query = `SELECT * FROM Events WHERE Timestamp BETWEEN @start AND @end`;
        const request = new mssql.Request();
        request.input('start', mssql.DateTime, start);
        request.input('end', mssql.DateTime, end);

        if (meterId) {
            query += ` AND MeterID = @meterId`;
            request.input('meterId', mssql.Int, parseInt(meterId));
        }
        
        const result = await request.query(query + ` ORDER BY Timestamp DESC`);
        res.json(result.recordset);
    } catch (err) {
        console.error('API Error: /api/events', err);
        res.status(500).json({ error: 'Failed to retrieve events.' });
    }
});

/**
 * GET /api/total-kwh-latest
 * Fetches the latest Total_KWH for all meters for the bar chart.
 */
app.get('/api/total-kwh-latest', async (req, res) => {
    try {
        const result = await mssql.query`
            SELECT t1.MeterID, t1.Total_KWH, t2.Location
            FROM Events t1
            INNER JOIN (
                SELECT MeterID, MAX(Timestamp) AS MaxTimestamp
                FROM Events
                GROUP BY MeterID
            ) AS latest_events ON t1.MeterID = latest_events.MeterID AND t1.Timestamp = latest_events.MaxTimestamp
            JOIN Meters t2 ON t1.MeterID = t2.MeterID
            ORDER BY t1.MeterID ASC;
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error('API Error: /api/total-kwh-latest', err);
        res.status(500).json({ error: 'Failed to retrieve latest KWH data.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});