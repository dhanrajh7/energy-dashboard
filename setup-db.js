// setup-db.js
const sqlite3 = require('sqlite3').verbose();
const { faker } = require('@faker-js/faker');
const moment = require('moment');
const db = new sqlite3.Database('./EM4.db');

db.serialize(() => {
    console.log('Clearing old data and tables...');
    db.run('DROP TABLE IF EXISTS Events');
    db.run('DROP TABLE IF EXISTS Meters');

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

    console.log('Inserting initial Meters data...');
    const meterStmt = db.prepare("INSERT INTO Meters VALUES (?, ?, ?, ?, ?)");
    const meterIDs = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115];
    meterIDs.forEach((id, index) => {
        const location = `Shop-${id - 100}`;
        const description = `Main Meter for Shop ${id - 100}`;
        const installationDate = moment('2025-09-01').toISOString().slice(0, 19).replace('T', ' ');
        meterStmt.run(id, location, description, installationDate, null);
    });
    meterStmt.finalize();

    console.log('Generating and inserting dynamic Events data (every 10 minutes for the last 3 days)...');
    const eventStmt = db.prepare(`
        INSERT INTO Events (
            MeterID, Timestamp, Current_L1, Current_L2, Current_L3, 
            Voltage_L1, Voltage_L2, Voltage_L3, PowerFactor_L1, 
            PowerFactor_L2, PowerFactor_L3, AvgCurrent, AvgVoltage, 
            AvgPowerFactor, Total_KW, Total_KWH
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = moment();
    const startDate = moment().subtract(3, 'days'); // <-- Changed to 3 days

    meterIDs.forEach(meterID => {
        let currentTimestamp = startDate.clone();
        let lastKWH = faker.number.int({ min: 100, max: 200 });

        while (currentTimestamp.isBefore(now)) {
            const avgCurrent = faker.number.float({ min: 15, max: 30, precision: 0.01 });
            const currentL1 = faker.number.float({ min: avgCurrent - 1, max: avgCurrent + 1, precision: 0.01 });
            const currentL2 = faker.number.float({ min: avgCurrent - 1, max: avgCurrent + 1, precision: 0.01 });
            const currentL3 = faker.number.float({ min: avgCurrent - 1, max: avgCurrent + 1, precision: 0.01 });
            
            const avgVoltage = faker.number.float({ min: 225, max: 235, precision: 0.01 });
            const voltageL1 = faker.number.float({ min: avgVoltage - 1, max: avgVoltage + 1, precision: 0.01 });
            const voltageL2 = faker.number.float({ min: avgVoltage - 1, max: avgVoltage + 1, precision: 0.01 });
            const voltageL3 = faker.number.float({ min: avgVoltage - 1, max: avgVoltage + 1, precision: 0.01 });

            const avgPowerFactor = faker.number.float({ min: 0.9, max: 0.99, precision: 0.01 });
            const powerFactorL1 = faker.number.float({ min: avgPowerFactor - 0.01, max: avgPowerFactor + 0.01, precision: 0.01 });
            const powerFactorL2 = faker.number.float({ min: avgPowerFactor - 0.01, max: avgPowerFactor + 0.01, precision: 0.01 });
            const powerFactorL3 = faker.number.float({ min: avgPowerFactor - 0.01, max: avgPowerFactor + 0.01, precision: 0.01 });

            const totalKW = faker.number.float({ min: 4, max: 6, precision: 0.1 });
            lastKWH += faker.number.float({ min: 0.1, max: 0.5, precision: 0.1 });
            
            eventStmt.run(
                meterID, currentTimestamp.toISOString().slice(0, 19).replace('T', ' '), 
                currentL1, currentL2, currentL3, voltageL1, voltageL2, voltageL3,
                powerFactorL1, powerFactorL2, powerFactorL3, avgCurrent, avgVoltage, avgPowerFactor,
                totalKW, lastKWH
            );
            
            currentTimestamp.add(10, 'minutes');
        }
    });

    eventStmt.finalize();
    console.log('Database EM4.db created and populated successfully with dynamic data.');
});

db.close();