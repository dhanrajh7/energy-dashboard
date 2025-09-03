// setup-db.js
const sqlite3 = require('sqlite3').verbose();
const { faker } = require('@faker-js/faker');
const db = new sqlite3.Database('./EM4.db');

db.serialize(() => {
    console.log('Ensuring Meters table is set up...');
    db.run(`CREATE TABLE IF NOT EXISTS Meters (
        MeterID INTEGER PRIMARY KEY,
        Location TEXT,
        Description TEXT,
        InstallationDate TEXT,
        LastCalibrationDate TEXT
    )`);

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

    console.log('Clearing old Events data and generating new dynamic data...');
    db.run('DROP TABLE IF EXISTS Events');
    
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

    const eventStmt = db.prepare(`
        INSERT INTO Events (
            MeterID, Timestamp, Current_L1, Current_L2, Current_L3, 
            Voltage_L1, Voltage_L2, Voltage_L3, PowerFactor_L1, 
            PowerFactor_L2, PowerFactor_L3, AvgCurrent, AvgVoltage, 
            AvgPowerFactor, Total_KW, Total_KWH
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const meterIDs = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115];
    let currentKWH = {};

    for (let i = 0; i < meterIDs.length; i++) {
        currentKWH[meterIDs[i]] = faker.number.int({ min: 100, max: 200 });
    }

    const totalEvents = 1000;
    for (let i = 0; i < totalEvents; i++) {
        const meterID = faker.helpers.arrayElement(meterIDs);
        const timestamp = faker.date.recent({ days: 30 }).toISOString().slice(0, 19).replace('T', ' ');
        
        const avgCurrent = faker.number.float({ min: 15, max: 30, precision: 0.01 });
        const currentL1 = faker.number.float({ min: avgCurrent - 2, max: avgCurrent + 2, precision: 0.01 });
        const currentL2 = faker.number.float({ min: avgCurrent - 2, max: avgCurrent + 2, precision: 0.01 });
        const currentL3 = faker.number.float({ min: avgCurrent - 2, max: avgCurrent + 2, precision: 0.01 });
        
        const avgVoltage = faker.number.float({ min: 225, max: 235, precision: 0.01 });
        const voltageL1 = faker.number.float({ min: avgVoltage - 1.5, max: avgVoltage + 1.5, precision: 0.01 });
        const voltageL2 = faker.number.float({ min: avgVoltage - 1.5, max: avgVoltage + 1.5, precision: 0.01 });
        const voltageL3 = faker.number.float({ min: avgVoltage - 1.5, max: avgVoltage + 1.5, precision: 0.01 });

        const avgPowerFactor = faker.number.float({ min: 0.9, max: 0.99, precision: 0.01 });
        const powerFactorL1 = faker.number.float({ min: avgPowerFactor - 0.02, max: avgPowerFactor + 0.02, precision: 0.01 });
        const powerFactorL2 = faker.number.float({ min: avgPowerFactor - 0.02, max: avgPowerFactor + 0.02, precision: 0.01 });
        const powerFactorL3 = faker.number.float({ min: avgPowerFactor - 0.02, max: avgPowerFactor + 0.02, precision: 0.01 });

        const totalKW = faker.number.float({ min: 4, max: 6, precision: 0.1 });
        currentKWH[meterID] += faker.number.float({ min: 0.1, max: 1.5, precision: 0.1 });
        
        eventStmt.run(
            meterID, timestamp, currentL1, currentL2, currentL3, voltageL1, voltageL2, voltageL3,
            powerFactorL1, powerFactorL2, powerFactorL3, avgCurrent, avgVoltage, avgPowerFactor,
            totalKW, currentKWH[meterID]
        );
    }
    eventStmt.finalize();

    console.log('Events table recreated and populated with dynamic data.');
});

db.close();