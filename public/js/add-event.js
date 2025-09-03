// public/js/add-event.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('addEventForm');
    const statusMessage = document.getElementById('statusMessage');
    const meterIdSelect = document.getElementById('meterIdInput');

    // Fetch meters to populate the dropdown
    async function fetchMeters() {
        const response = await fetch('/api/meters');
        const meters = await response.json();
        
        meters.forEach(meter => {
            const option = document.createElement('option');
            option.value = meter.MeterID;
            option.textContent = `${meter.MeterID} - ${meter.Location}`;
            meterIdSelect.appendChild(option);
        });
        
        // Set default timestamp to now
        document.getElementById('timestampInput').value = new Date().toISOString().slice(0, 16);
        
        // Load initial data for the first meter
        if (meters.length > 0) {
            fetchLatestData(meters[0].MeterID);
        }
    }

    // New function to fetch and populate latest data for a meter
    async function fetchLatestData(meterId) {
        if (!meterId) return;
        
        try {
            const response = await fetch(`/api/live-data/${meterId}`);
            const data = await response.json();

            if (data) {
                document.getElementById('currentL1Input').value = (data.AvgCurrent || 0).toFixed(2);
                document.getElementById('currentL2Input').value = (data.AvgCurrent || 0).toFixed(2);
                document.getElementById('currentL3Input').value = (data.AvgCurrent || 0).toFixed(2);
                document.getElementById('voltageL1Input').value = (data.AvgVoltage || 0).toFixed(2);
                document.getElementById('voltageL2Input').value = (data.AvgVoltage || 0).toFixed(2);
                document.getElementById('voltageL3Input').value = (data.AvgVoltage || 0).toFixed(2);
                document.getElementById('pfL1Input').value = (data.AvgPowerFactor || 0).toFixed(2);
                document.getElementById('pfL2Input').value = (data.AvgPowerFactor || 0).toFixed(2);
                document.getElementById('pfL3Input').value = (data.AvgPowerFactor || 0).toFixed(2);
                document.getElementById('avgCurrentInput').value = (data.AvgCurrent || 0).toFixed(2);
                document.getElementById('avgVoltageInput').value = (data.AvgVoltage || 0).toFixed(2);
                document.getElementById('avgPfInput').value = (data.AvgPowerFactor || 0).toFixed(2);
                // Note: Total_KW and Total_KWH are often cumulative or calculated, so we'll just use the latest value as a starting point.
                document.getElementById('totalKwInput').value = (data.Total_KW || 0).toFixed(2);
                document.getElementById('totalKwhInput').value = (data.Total_KWH || 0).toFixed(2);
            }
        } catch (error) {
            console.error('Failed to fetch latest data:', error);
        }
    }

    meterIdSelect.addEventListener('change', (e) => {
        fetchLatestData(e.target.value);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Collect all form data
        const formData = {
            MeterID: parseInt(document.getElementById('meterIdInput').value),
            Timestamp: document.getElementById('timestampInput').value,
            Current_L1: parseFloat(document.getElementById('currentL1Input').value),
            Current_L2: parseFloat(document.getElementById('currentL2Input').value),
            Current_L3: parseFloat(document.getElementById('currentL3Input').value),
            Voltage_L1: parseFloat(document.getElementById('voltageL1Input').value),
            Voltage_L2: parseFloat(document.getElementById('voltageL2Input').value),
            Voltage_L3: parseFloat(document.getElementById('voltageL3Input').value),
            PowerFactor_L1: parseFloat(document.getElementById('pfL1Input').value),
            PowerFactor_L2: parseFloat(document.getElementById('pfL2Input').value),
            PowerFactor_L3: parseFloat(document.getElementById('pfL3Input').value),
            AvgCurrent: parseFloat(document.getElementById('avgCurrentInput').value),
            AvgVoltage: parseFloat(document.getElementById('avgVoltageInput').value),
            AvgPowerFactor: parseFloat(document.getElementById('avgPfInput').value),
            Total_KW: parseFloat(document.getElementById('totalKwInput').value),
            Total_KWH: parseFloat(document.getElementById('totalKwhInput').value),
        };

        try {
            const response = await fetch('/api/add-event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const result = await response.json();

            if (response.ok) {
                statusMessage.innerHTML = `<div class="alert alert-success">✅ ${result.message} Event ID: ${result.eventId}</div>`;
                form.reset();
                document.getElementById('timestampInput').value = new Date().toISOString().slice(0, 16);
            } else {
                statusMessage.innerHTML = `<div class="alert alert-danger">❌ Error: ${result.error}</div>`;
            }
        } catch (error) {
            statusMessage.innerHTML = `<div class="alert alert-danger">❌ An unexpected error occurred: ${error.message}</div>`;
        }
    });

    fetchMeters();
});