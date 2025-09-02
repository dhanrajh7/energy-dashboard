// setup-db.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./EM4.db');

db.serialize(() => {
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

    // Insert data into Meters
    const meterStmt = db.prepare("INSERT OR IGNORE INTO Meters (MeterID, Location, Description, InstallationDate, LastCalibrationDate) VALUES (?, ?, ?, ?, ?)");
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

    // Insert data into Events
    const eventStmt = db.prepare("INSERT INTO Events (MeterID, Timestamp, Current_L1, Current_L2, Current_L3, Voltage_L1, Voltage_L2, Voltage_L3, PowerFactor_L1, PowerFactor_L2, PowerFactor_L3, AvgCurrent, AvgVoltage, AvgPowerFactor, Total_KW, Total_KWH) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const eventsData = [
        [101, '2025-09-01 15:45:59', 25.5, 26.1, 24.9, 230.1, 229.8, 230.5, 0.98, 0.97, 0.99, 25.5, 230.1, 0.98, 5.2, 125.5],
        [102, '2025-09-01 15:46:06', 25.5, 26.1, 24.9, 230.1, 229.8, 230.5, 0.98, 0.97, 0.96, 25.5, 270.1, 0.98, 5.2, 125.5],
        [101, '2025-09-01 15:47:02', 22.5, 26.1, 24.9, 230.1, 229.8, 230.5, 0.98, 0.97, 0.96, 25.5, 270.1, 0.98, 5.2, 125.5],
        [103, '2025-09-01 15:51:26', 22.5, 26.1, 24.9, 230.1, 229.8, 230.5, 0.98, 0.97, 0.96, 25, 270.1, 0.98, 5.2, 125.5],
        [102, '2025-09-01 15:51:34', 22.5, 26.1, 24.9, 230.1, 229.8, 230.5, 0.98, 0.97, 0.96, 25, 270.1, 0.98, 5.2, 125.5],
        [101, '2025-09-01 15:51:43', 22.5, 26.1, 24.9, 230.1, 229.8, 230.5, 0.98, 0.97, 0.96, 25, 270.1, 0.98, 5.2, 125.5],
        [101, '2025-09-02 04:05:55', 25.5, 26.1, 24.9, 230.1, 229.8, 230.5, 0.98, 0.97, 0.99, 25.5, 230.1, 0.98, 5.2, 125.5],
        [102, '2025-09-02 04:05:55', 24.8, 25.5, 24.2, 231, 230.5, 231.2, 0.96, 0.95, 0.97, 24.83, 230.9, 0.96, 4.9, 130.8],
        [103, '2025-09-02 04:05:55', 22.1, 22.8, 21.9, 229.5, 229, 229.8, 0.95, 0.94, 0.96, 22.27, 229.43, 0.95, 4.5, 115.6],
        [104, '2025-09-02 04:05:55', 26.3, 27, 26.5, 232.1, 231.8, 232.5, 0.99, 0.98, 0.97, 26.6, 232.13, 0.98, 5.8, 140.2],
        [105, '2025-09-02 04:05:55', 21.5, 22, 21.8, 228, 228.5, 228.2, 0.92, 0.93, 0.91, 21.77, 228.23, 0.92, 4.1, 105.7],
        [106, '2025-09-02 04:05:55', 23, 23.5, 22.8, 230.8, 231, 230.5, 0.97, 0.96, 0.95, 23.1, 230.77, 0.96, 4.8, 128.3],
        [107, '2025-09-02 04:05:55', 20.1, 20.5, 20.3, 227, 227.5, 227.2, 0.94, 0.95, 0.93, 20.3, 227.23, 0.94, 3.9, 99.4],
        [108, '2025-09-02 04:05:55', 28.5, 29, 28.8, 233, 232.8, 233.5, 0.99, 0.98, 0.99, 28.77, 233.1, 0.99, 6.2, 150.9],
        [109, '2025-09-02 04:05:55', 19.8, 20.2, 19.5, 226.5, 226.8, 226.2, 0.91, 0.92, 0.90, 19.83, 226.5, 0.91, 3.7, 95.8],
        [110, '2025-09-02 04:05:55', 24, 24.5, 23.8, 230, 230.2, 229.8, 0.98, 0.97, 0.96, 24.1, 230, 0.97, 5, 120.5],
        [111, '2025-09-02 04:05:55', 27.5, 28, 27.8, 231.5, 231.8, 231.2, 0.96, 0.95, 0.97, 27.77, 231.5, 0.96, 5.9, 145.1],
        [112, '2025-09-02 04:05:55', 20.5, 21, 20.3, 228.8, 229, 228.5, 0.94, 0.93, 0.95, 20.6, 228.77, 0.94, 4, 100.9],
        [113, '2025-09-02 04:09:55', 22, 22.5, 21.8, 229, 229.5, 229.2, 0.95, 0.96, 0.94, 22.1, 229.23, 0.95, 4.4, 110.3],
        [114, '2025-09-02 04:34:55', 25, 25.5, 24.8, 231.8, 232, 231.5, 0.98, 0.97, 0.99, 25.1, 231.77, 0.98, 5.1, 128.7],
        [115, '2025-09-02 04:35:55', 28, 28.5, 27.8, 230.8, 231, 230.5, 0.96, 0.95, 0.97, 28.1, 230.77, 0.96, 5.7, 145.5],
        [101, '2025-09-02 04:37:55', 25.5, 26.1, 24.9, 230.1, 229.8, 230.5, 0.98, 0.97, 0.99, 25.5, 230.1, 0.98, 5.2, 125.5]
    ];
    eventsData.forEach(data => eventStmt.run(data));
    eventStmt.finalize();
});

db.close();
console.log('Database EM4.db created and populated successfully.');