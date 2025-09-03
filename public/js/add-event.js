// public/js/add-event.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('addEventForm');
    const statusMessage = document.getElementById('statusMessage');
    const meterIdSelect = document.getElementById('meterIdInput');
    const updateAllMetersBtn = document.getElementById('updateAllMetersBtn');
    const updateStatusMessage = document.getElementById('updateStatusMessage');
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    const uploadExcelForm = document.getElementById('uploadExcelForm');
    const uploadStatusMessage = document.getElementById('uploadStatusMessage');

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
        
        // Set default timestamp to now (local time)
        document.getElementById('timestampInput').value = moment().format('YYYY-MM-DDTHH:mm');
        
        // Load initial data for the first meter
        if (meters.length > 0) {
            fetchLatestData(meters[0].MeterID);
        }
    }

    // Function to fetch and populate latest data for a meter
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
                document.getElementById('totalKwInput').value = (data.Total_KW || 0).toFixed(2);
                document.getElementById('totalKwhInput').value = (data.Total_KWH || 0).toFixed(2);
            }
        } catch (error) {
            console.error('Failed to fetch latest data:', error);
        }
    }

    // --- Event Listeners ---

    // When a meter is selected, fetch its latest data
    meterIdSelect.addEventListener('change', (e) => {
        fetchLatestData(e.target.value);
    });

    // Handle "Update All Meters" button click
    updateAllMetersBtn.addEventListener('click', async () => {
        try {
            updateStatusMessage.innerHTML = `<div class="alert alert-info">Updating all meters...</div>`;
            const response = await fetch('/api/add-latest-events', { method: 'POST' });
            const result = await response.json();
            if (response.ok) {
                updateStatusMessage.innerHTML = `<div class="alert alert-success">✅ ${result.message}</div>`;
            } else {
                updateStatusMessage.innerHTML = `<div class="alert alert-danger">❌ Error: ${result.error}</div>`;
            }
        } catch (error) {
            updateStatusMessage.innerHTML = `<div class="alert alert-danger">❌ An unexpected error occurred: ${error.message}</div>`;
        }
    });

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

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

        // Ensure timestamp is current time on submission
        formData.Timestamp = moment().format('YYYY-MM-DD HH:mm:ss');

        try {
            const response = await fetch('/api/add-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const result = await response.json();

            if (response.ok) {
                statusMessage.innerHTML = `<div class="alert alert-success">✅ ${result.message} Event ID: ${result.eventId}</div>`;
                form.reset();
                document.getElementById('timestampInput').value = moment().format('YYYY-MM-DDTHH:mm');
                fetchLatestData(meterIdSelect.value); // Refresh data after successful add
            } else {
                statusMessage.innerHTML = `<div class="alert alert-danger">❌ Error: ${result.error}</div>`;
            }
        } catch (error) {
            statusMessage.innerHTML = `<div class="alert alert-danger">❌ An unexpected error occurred: ${error.message}</div>`;
        }
    });

    // Handle Excel download button
    downloadTemplateBtn.addEventListener('click', () => {
        window.location.href = '/api/events/download';
    });

    // Handle Excel upload form submission
    uploadExcelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('excelFileInput');
        const file = fileInput.files[0];
        if (!file) {
            uploadStatusMessage.innerHTML = `<div class="alert alert-warning">Please select a file to upload.</div>`;
            return;
        }

        const formData = new FormData();
        formData.append('excelFile', file);

        try {
            uploadStatusMessage.innerHTML = `<div class="alert alert-info">Uploading file...</div>`;
            const response = await fetch('/api/events/upload', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (response.ok) {
                uploadStatusMessage.innerHTML = `<div class="alert alert-success">✅ ${result.message}</div>`;
            } else {
                uploadStatusMessage.innerHTML = `<div class="alert alert-danger">❌ Error: ${result.error}</div>`;
            }
        } catch (error) {
            uploadStatusMessage.innerHTML = `<div class="alert alert-danger">❌ An unexpected error occurred: ${error.message}</div>`;
        }
    });

    fetchMeters();
});