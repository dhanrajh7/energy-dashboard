// setup-db.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./EM4.db');

db.serialize(() => {
    console.log('Clearing old data and tables...');
    db.run('DROP TABLE IF EXISTS Events');
    db.run('DROP TABLE IF EXISTS Meters');
    db.run('DROP TABLE IF EXISTS AlertRules');
    db.run('DROP TABLE IF EXISTS TriggeredAlerts');

    // Create Meters table
    db.run(`CREATE TABLE IF NOT EXISTS Meters (
        MeterID INTEGER PRIMARY KEY,
        Location TEXT,
        Description TEXT,
        InstallationDate TEXT,
        LastCalibrationDate TEXT
    )`);

    // Create Events table
    db.run(`CREATE TABLE IF NOT EXISTS Events (
        EventID INTEGER PRIMARY KEY AUTOINCREMENT,
        MeterID INTEGER,
        Timestamp TEXT,
        Current_L1 REAL,
        Current_L2 REAL,
        Current_L3 REAL,
        Voltage_L1 REAL,
        Voltage_L2 REAL,
        Voltage_L3 REAL,
        PowerFactor_L1 REAL,
        PowerFactor_L2 REAL,
        PowerFactor_L3 REAL,
        AvgCurrent REAL,
        AvgVoltage REAL,
        AvgPowerFactor REAL,
        Total_KW REAL,
        Total_KWH REAL,
        FOREIGN KEY(MeterID) REFERENCES Meters(MeterID)
    )`);

    // Create AlertRules table
    db.run(`CREATE TABLE IF NOT EXISTS AlertRules (
        AlertID INTEGER PRIMARY KEY AUTOINCREMENT,
        MeterID INTEGER,
        Parameter TEXT,
        Threshold REAL,
        Message TEXT,
        IsActive INTEGER DEFAULT 1,
        FOREIGN KEY(MeterID) REFERENCES Meters(MeterID)
    )`);

    // Create TriggeredAlerts table
    db.run(`CREATE TABLE IF NOT EXISTS TriggeredAlerts (
        TriggeredID INTEGER PRIMARY KEY AUTOINCREMENT,
        AlertID INTEGER,
        MeterID INTEGER,
        Timestamp TEXT,
        Message TEXT,
        FOREIGN KEY(AlertID) REFERENCES AlertRules(AlertID)
    )`);

    console.log('Inserting initial Meters data...');
    const meterStmt = db.prepare("INSERT OR IGNORE INTO Meters VALUES (?, ?, ?, ?, ?)");
    const metersData = [
        [101, 'Shop-1', 'Main Meter for Shop 1', '2025-09-01 15:44:00', null],
        [102, 'Shop-2', 'Main Meter for Shop 2', '2025-09-01 15:44:00', null],
        [103, 'Shop-3', 'Main Meter for Shop 3', '2025-09-01 15:44:39', null],
        [104, 'Shop-4', 'Main Meter for Shop 4', '2025-09-01 15:45:00', null],
        [105, 'Shop-5', 'Main Meter for Shop 5', '2025-09-01 15:45:20', null],
        [106, 'Shop-6', 'Main Meter for Shop 6', '2025-09-01 15:45:30', null],
        [107, 'Shop-7', 'Main Meter for Shop 7', '2025-09-01 15:45:40', null],
        [108, 'Shop-8', 'Main Meter for Shop 8', '2025-09-01 15:45:50', null],
        [109, 'Shop-9', 'Main Meter for Shop 9', '2025-09-01 15:46:00', null],
        [110, 'Shop-10', 'Main Meter for Shop 10', '2025-09-01 15:46:10', null],
        [111, 'Shop-11', 'Main Meter for Shop 11', '2025-09-01 15:46:20', null],
        [112, 'Shop-12', 'Main Meter for Shop 12', '2025-09-01 15:46:30', null],
        [113, 'Shop-13', 'Main Meter for Shop 13', '2025-09-01 15:46:40', null],
        [114, 'Shop-14', 'Main Meter for Shop 14', '2025-09-01 15:46:50', null],
        [115, 'Shop-15', 'Main Meter for Shop 15', '2025-09-01 15:46:50', null]
    ];
    metersData.forEach(data => meterStmt.run(data));
    meterStmt.finalize();
    console.log('Meters data check complete. Existing meters are preserved.');

    console.log('Generating and inserting dynamic Events data...');
    // ... (Your dynamic event data generation logic goes here, as it was in the previous response) ...

    console.log('Populating sample Alert Rules...');
    const alertRulesStmt = db.prepare(`
        INSERT INTO AlertRules (MeterID, Parameter, Threshold, Message) 
        VALUES (?, ?, ?, ?)
    `);
    const rulesData = [
        [101, 'AvgCurrent', 26.0, 'Shop 1 meter high current'],
        [102, 'AvgVoltage', 232.0, 'Shop 2 meter high voltage']
    ];
    rulesData.forEach(data => alertRulesStmt.run(data));
    alertRulesStmt.finalize();

    console.log('Database setup complete.');
});

db.close();