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

    // Function to populate the form with data
    function populateForm(data) {
        // Fallback to dummy data if no data is provided
        const eventData = data || {
            Current_L1: 25.50, Current_L2: 24.80, Current_L3: 26.10,
            Voltage_L1: 230.15, Voltage_L2: 228.90, Voltage_L3: 231.25,
            PowerFactor_L1: 0.98, PowerFactor_L2: 0.99, PowerFactor_L3: 0.97,
            AvgCurrent: 25.47, AvgVoltage: 230.10, AvgPowerFactor: 0.98,
            Total_KW: 17.50, Total_KWH: 1024.75
        };

        // Populate the form fields with the data
        document.getElementById('timestampInput').value = moment().format('YYYY-MM-DDTHH:mm');
        document.getElementById('currentL1Input').value = (eventData.Current_L1).toFixed(2);
        document.getElementById('currentL2Input').value = (eventData.Current_L2).toFixed(2);
        document.getElementById('currentL3Input').value = (eventData.Current_L3).toFixed(2);
        document.getElementById('voltageL1Input').value = (eventData.Voltage_L1).toFixed(2);
        document.getElementById('voltageL2Input').value = (eventData.Voltage_L2).toFixed(2);
        document.getElementById('voltageL3Input').value = (eventData.Voltage_L3).toFixed(2);
        document.getElementById('pfL1Input').value = (eventData.PowerFactor_L1).toFixed(2);
        document.getElementById('pfL2Input').value = (eventData.PowerFactor_L2).toFixed(2);
        document.getElementById('pfL3Input').value = (eventData.PowerFactor_L3).toFixed(2);
        document.getElementById('avgCurrentInput').value = (eventData.AvgCurrent).toFixed(2);
        document.getElementById('avgVoltageInput').value = (eventData.AvgVoltage).toFixed(2);
        document.getElementById('avgPfInput').value = (eventData.AvgPowerFactor).toFixed(2);
        document.getElementById('totalKwInput').value = (eventData.Total_KW).toFixed(2);
        document.getElementById('totalKwhInput').value = (eventData.Total_KWH).toFixed(2);
        
        // Hide any previous error message
        statusMessage.innerHTML = '';
    }
    
    // Function to fetch the latest event for a specific meter
    async function fetchLatestData(meterId) {
        if (!meterId) {
            populateForm();
            return;
        }
        try {
            const response = await fetch(`/api/live-data/${meterId}`);
            if (!response.ok) throw new Error('Failed to fetch latest data.');
            const data = await response.json();
            populateForm(data);
        } catch (error) {
            console.error('Error fetching latest data:', error);
            // Fallback to dummy data if fetching fails
            populateForm();
        }
    }
    
    // Initial load function
    async function initializeForm() {
        try {
            const response = await fetch('/api/meters');
            if (!response.ok) throw new Error('Failed to fetch meters.');
            const meters = await response.json();
            
            if (meters.length > 0) {
                // Meters found, populate dropdown and fetch latest data
                meters.forEach(meter => {
                    const option = document.createElement('option');
                    option.value = meter.MeterID;
                    option.textContent = `${meter.MeterID} - ${meter.Location}`;
                    meterIdSelect.appendChild(option);
                });
                await fetchLatestData(meters[0].MeterID);
            } else {
                // No meters found, display a warning and populate with dummy data
                statusMessage.innerHTML = `<div class="alert alert-warning">No meters found. Please add a meter first.</div>`;
                const dummyMeterId = '101';
                const option = document.createElement('option');
                option.value = dummyMeterId;
                option.textContent = `${dummyMeterId} - Dummy Meter`;
                meterIdSelect.appendChild(option);
                populateForm();
            }
        } catch (error) {
            console.error('Failed to fetch meters:', error);
            statusMessage.innerHTML = `<div class="alert alert-danger">❌ An unexpected error occurred: ${error.message}</div>`;
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
            MeterID: meterIdSelect.value,
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const result = await response.json();

            if (response.ok) {
                statusMessage.innerHTML = `<div class="alert alert-success">✅ ${result.message}</div>`;
                // Add a delay before resetting the form to allow the user to see the success message
                setTimeout(() => {
                    form.reset();
                    initializeForm();
                }, 2000); // 2-second delay
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

    initializeForm();
});