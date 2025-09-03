// public/js/dashboard.js
document.addEventListener('DOMContentLoaded', () => {
    // --------------------------------------------------------------------------------------------------------------------
    // Global State & UI Elements
    // --------------------------------------------------------------------------------------------------------------------
    const meterCardsContainer = document.getElementById('meter-cards-container');
    const chartMeterSelect = document.getElementById('chartMeterSelect');
    const eventMeterSelect = document.getElementById('eventMeterSelect');
    const alertMeterSelect = document.getElementById('alertMeterSelect');
    const kwhBarChartCanvas = document.getElementById('kwhBarChart');
    const powerFactorLineChartCanvas = document.getElementById('powerFactorLineChart');
    const currentLineChartCanvas = document.getElementById('currentLineChart');
    const eventsTableBody = document.getElementById('eventsTableBody');
    const activeAlertsList = document.getElementById('activeAlertsList');
    const triggeredAlertsList = document.getElementById('triggeredAlertsList');
    const toastContainer = document.querySelector('.toast-container');
    const powerFactorModalChartCanvas = document.getElementById('powerFactorModalChart');
    const currentModalChartCanvas = document.getElementById('currentModalChart');
    const alertCountBadge = document.getElementById('alertCountBadge');

    // In-memory state
    let meters = [];
    let activeAlerts = JSON.parse(localStorage.getItem('activeAlerts')) || [];
    let triggeredAlerts = JSON.parse(sessionStorage.getItem('triggeredAlerts')) || [];
    let editingAlertIndex = -1; // -1 means no alert is being edited
    
    // Default date range (last 24 hours)
    const defaultEndDate = moment();
    const defaultStartDate = moment().subtract(24, 'hours');
    
    // Initialize date inputs with default values
    document.getElementById('chartStartDate').value = defaultStartDate.format('YYYY-MM-DDTHH:mm');
    document.getElementById('chartEndDate').value = defaultEndDate.format('YYYY-MM-DDTHH:mm');
    document.getElementById('eventStartDate').value = defaultStartDate.format('YYYY-MM-DDTHH:mm');
    document.getElementById('eventEndDate').value = defaultEndDate.format('YYYY-MM-DDTHH:mm');
    
    let kwhChart, pfChart, currentChart, pfModalChart, currentModalChart;

    // --------------------------------------------------------------------------------------------------------------------
    // Initialization and Data Fetching
    // --------------------------------------------------------------------------------------------------------------------

    /**
     * Fetches all meters and populates the dropdowns.
     */
    async function fetchMeters() {
        const response = await fetch('/api/meters');
        const metersData = await response.json();
        
        meters = metersData;

        // Populate dropdowns
        meters.forEach(meter => {
            const option1 = document.createElement('option');
            option1.value = meter.MeterID;
            option1.textContent = `${meter.MeterID} - ${meter.Location}`;
            chartMeterSelect.appendChild(option1);
            
            const option2 = option1.cloneNode(true);
            eventMeterSelect.appendChild(option2);

            const option3 = option1.cloneNode(true);
            alertMeterSelect.appendChild(option3);
        });
        
        // Select the first meter by default
        if (meters.length > 0) {
            chartMeterSelect.value = meters[0].MeterID;
        }

        // Initial data loads
        await updateAllMeterCards(); 
        fetchAndRenderKWHBarChart();
        updateHistoricalCharts();
        fetchAndRenderEvents();
        renderAlerts();
        renderTriggeredAlerts();
    }
    
    /**
     * Updates all meter cards with the latest data, performing partial DOM updates.
     */
    async function updateAllMeterCards() {
        const now = moment();
        for (const meter of meters) {
            const liveData = await fetchLiveData(meter.MeterID);
            
            let cardCol = document.getElementById(`meter-card-${meter.MeterID}`);
            if (!cardCol) {
                cardCol = document.createElement('div');
                cardCol.className = 'col';
                cardCol.id = `meter-card-${meter.MeterID}`;
                meterCardsContainer.appendChild(cardCol);
            }
            
            createOrUpdateMeterCard(meter, liveData, now, cardCol);
        }
    }
    
    /**
     * Fetches the latest event for a single meter.
     * @param {number} meterId
     */
    async function fetchLiveData(meterId) {
        const response = await fetch(`/api/live-data/${meterId}`);
        return await response.json();
    }

    // --------------------------------------------------------------------------------------------------------------------
    // Meter Card Rendering (Partial Update)
    // --------------------------------------------------------------------------------------------------------------------

    /**
     * Creates or updates a meter card in the UI.
     * @param {object} meter
     * @param {object} liveData
     * @param {moment} now
     * @param {HTMLElement} cardCol - The existing or new card container element
     */
    function createOrUpdateMeterCard(meter, liveData, now, cardCol) {
        let statusLightClass = 'status-red';
        let lastUpdatedText = 'No data available';
        let cardBodyContent = `<p class="card-subtitle mb-2">${meter.Description}</p><p class="text-muted">No recent data available.</p>`;
        
        if (liveData) {
            const timestampUTC = moment.utc(liveData.Timestamp);
            const minutesAgo = now.diff(timestampUTC, 'minutes');
            statusLightClass = minutesAgo < 2 ? 'status-green' : 'status-red';
            lastUpdatedText = `Last updated: ${timestampUTC.local().format('YYYY-MM-DD HH:mm:ss')} (${minutesAgo} mins ago)`;
            
            cardBodyContent = `
                <p class="card-subtitle mb-2">${meter.Description}</p>
                <div class="meter-data-grid">
                    <span class="value-label">Avg. Current:</span><span class="value-data">${liveData.AvgCurrent ? liveData.AvgCurrent.toFixed(2) : 'N/A'} A</span>
                    <span class="value-label">Avg. Voltage:</span><span class="value-data">${liveData.AvgVoltage ? liveData.AvgVoltage.toFixed(2) : 'N/A'} V</span>
                    <span class="value-label">Avg. Power Factor:</span><span class="value-data">${liveData.AvgPowerFactor ? liveData.AvgPowerFactor.toFixed(2) : 'N/A'}</span>
                    <span class="value-label">Total KWH:</span><span class="value-data">${liveData.Total_KWH ? liveData.Total_KWH.toFixed(2) : 'N/A'} kWh</span>
                    <span class="value-label">Install Date:</span><span class="value-data">${moment(meter.InstallationDate).format('YYYY-MM-DD')}</span>
                </div>
            `;

            // Check for alerts
            checkAlerts(meter.MeterID, liveData);
        }
        
        // Only update the innerHTML of the card
        cardCol.innerHTML = `
            <div class="card h-100 shadow-sm">
                <div class="card-header">
                    <h5 class="shop-name-box">${meter.Location}</h5>
                    <div class="d-flex align-items-center gap-2">
                        <span>${meter.MeterID}</span>
                        <span class="status-light ${statusLightClass}" title="${statusLightClass === 'status-green' ? 'Online' : 'Offline'}"></span>
                    </div>
                </div>
                <div class="card-body">
                    ${cardBodyContent}
                </div>
                <div class="card-footer text-center">
                    <small>${lastUpdatedText}</small>
                </div>
            </div>
        `;
    }
    
    // Auto-refresh meter cards every 5 seconds
    setInterval(updateAllMeterCards, 5000);

    // --------------------------------------------------------------------------------------------------------------------
    // Chart.js Implementations
    // --------------------------------------------------------------------------------------------------------------------

    /**
     * Fetches latest KWH data and renders the bar chart.
     */
    async function fetchAndRenderKWHBarChart() {
        const response = await fetch('/api/total-kwh-latest');
        const data = await response.json();
        
        const labels = data.map(d => `${d.Location} (${d.MeterID})`);
        const kwhData = data.map(d => d.Total_KWH);
        
        if (kwhChart) kwhChart.destroy();
        kwhChart = new Chart(kwhBarChartCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Latest Total KWH',
                    data: kwhData,
                    backgroundColor: 'rgba(97, 175, 239, 0.8)', // Updated to blue
                    borderColor: '#61afef',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { 
                        beginAtZero: true, 
                        title: { display: true, text: 'Total KWH' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' } 
                    },
                    x: { grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                },
                plugins: {
                    legend: { labels: { color: 'white' } }
                }
            }
        });
    }
    
    /**
     * Fetches historical data and renders the line charts.
     */
    async function updateHistoricalCharts() {
        const meterId = chartMeterSelect.value;
        const startDate = document.getElementById('chartStartDate').value;
        const endDate = document.getElementById('chartEndDate').value;
        
        if (!meterId) return;

        const response = await fetch(`/api/historical-data/${meterId}?startDate=${startDate}&endDate=${endDate}`);
        const data = await response.json();
        
        const labels = data.map(d => moment.utc(d.Timestamp).local().format('HH:mm:ss'));
        
        // Power Factor Chart
        if (pfChart) pfChart.destroy();
        pfChart = new Chart(powerFactorLineChartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Avg. Power Factor', data: data.map(d => d.AvgPowerFactor), borderColor: '#A9B1BD', borderWidth: 2, fill: false },
                    { label: 'PF L1', data: data.map(d => d.PowerFactor_L1), borderColor: '#28a745', borderWidth: 1, fill: false, borderDash: [5, 5] },
                    { label: 'PF L2', data: data.map(d => d.PowerFactor_L2), borderColor: '#ffc107', borderWidth: 1, fill: false, borderDash: [5, 5] },
                    { label: 'PF L3', data: data.map(d => d.PowerFactor_L3), borderColor: '#dc3545', borderWidth: 1, fill: false, borderDash: [5, 5] }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: { 
                        title: { display: true, text: 'Time' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' } 
                    },
                    y: { 
                        beginAtZero: true, 
                        title: { display: true, text: 'Power Factor' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                },
                plugins: {
                    legend: { labels: { color: 'white' } }
                }
            }
        });

        // Current Chart
        if (currentChart) currentChart.destroy();
        currentChart = new Chart(currentLineChartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Avg. Current', data: data.map(d => d.AvgCurrent), borderColor: '#A9B1BD', borderWidth: 2, fill: false },
                    { label: 'Current L1', data: data.map(d => d.Current_L1), borderColor: '#28a745', borderWidth: 1, fill: false, borderDash: [5, 5] },
                    { label: 'Current L2', data: data.map(d => d.Current_L2), borderColor: '#ffc107', borderWidth: 1, fill: false, borderDash: [5, 5] },
                    { label: 'Current L3', data: data.map(d => d.Current_L3), borderColor: '#dc3545', borderWidth: 1, fill: false, borderDash: [5, 5] }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: { 
                        title: { display: true, text: 'Time' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' } 
                    },
                    y: { 
                        beginAtZero: true, 
                        title: { display: true, text: 'Current (A)' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' } 
                    }
                },
                plugins: {
                    legend: { labels: { color: 'white' } }
                }
            }
        });
    }
    
    // Event listener for chart update button
    document.getElementById('updateChartsBtn').addEventListener('click', updateHistoricalCharts);
    chartMeterSelect.addEventListener('change', updateHistoricalCharts);

    // --------------------------------------------------------------------------------------------------------------------
    // Event Table
    // --------------------------------------------------------------------------------------------------------------------

    /**
     * Fetches and renders events in the table.
     */
    async function fetchAndRenderEvents() {
        const meterId = document.getElementById('eventMeterSelect').value;
        const startDate = document.getElementById('eventStartDate').value;
        const endDate = document.getElementById('eventEndDate').value;
        
        const url = `/api/events?meterId=${meterId}&startDate=${startDate}&endDate=${endDate}`;
        const response = await fetch(url);
        const events = await response.json();
        
        eventsTableBody.innerHTML = '';
        events.forEach(event => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${event.EventID}</td>
                <td>${event.MeterID}</td>
                <td>${moment.utc(event.Timestamp).local().format('YYYY-MM-DD HH:mm:ss')}</td>
                <td>${event.AvgCurrent ? event.AvgCurrent.toFixed(2) : 'N/A'}</td>
                <td>${event.AvgVoltage ? event.AvgVoltage.toFixed(2) : 'N/A'}</td>
                <td>${event.AvgPowerFactor ? event.AvgPowerFactor.toFixed(2) : 'N/A'}</td>
                <td>${event.Total_KW ? event.Total_KW.toFixed(2) : 'N/A'}</td>
                <td>${event.Total_KWH ? event.Total_KWH.toFixed(2) : 'N/A'}</td>
            `;
            eventsTableBody.appendChild(row);
        });
    }

    // Event listener for event table filter button
    document.getElementById('filterEventsBtn').addEventListener('click', fetchAndRenderEvents);
    
    // --------------------------------------------------------------------------------------------------------------------
    // Alert System
    // --------------------------------------------------------------------------------------------------------------------

    /**
     * Renders the list of active alerts.
     */
    function renderAlerts() {
        activeAlertsList.innerHTML = '';
        activeAlerts.forEach((alert, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center bg-transparent';
            listItem.innerHTML = `
                <div>
                    <strong>Meter ${alert.meterId}</strong>: ${alert.param} > ${alert.threshold}
                    <p class="text-muted mb-0"><small>"${alert.message}"</small></p>
                </div>
                <div class="btn-group">
                    <button type="button" class="btn btn-sm btn-info edit-alert-btn" data-index="${index}"><i class="bi bi-pencil"></i></button>
                    <button type="button" class="btn btn-sm btn-danger remove-alert-btn" data-index="${index}"><i class="bi bi-x-lg"></i></button>
                </div>
            `;
            activeAlertsList.appendChild(listItem);
        });
    }

    function renderTriggeredAlerts() {
        triggeredAlertsList.innerHTML = '';
        triggeredAlerts.forEach(alert => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center bg-transparent';
            listItem.innerHTML = `
                <div>
                    <strong>[${moment.utc(alert.timestamp).local().format('HH:mm:ss')}] Alert on Meter ${alert.meterId}</strong>
                    <p class="text-muted mb-0"><small>"${alert.message}"</small></p>
                </div>
            `;
            triggeredAlertsList.appendChild(listItem);
        });

        // Update notification badge
        if (triggeredAlerts.length > 0) {
            alertCountBadge.textContent = triggeredAlerts.length;
            alertCountBadge.classList.remove('d-none');
        } else {
            alertCountBadge.classList.add('d-none');
        }
    }
    
    // Handle alert form submission
    document.getElementById('alertForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const meterId = document.getElementById('alertMeterSelect').value;
        const param = document.getElementById('alertParamSelect').value;
        const threshold = parseFloat(document.getElementById('alertThreshold').value);
        const message = document.getElementById('alertMessage').value;
        const alertIndex = parseInt(document.getElementById('alertIndex').value);
        
        if (alertIndex !== -1) {
            // Update existing alert
            activeAlerts[alertIndex] = { meterId, param, threshold, message };
            document.getElementById('alertIndex').value = -1;
            document.getElementById('alertForm').querySelector('button[type="submit"]').innerText = 'Save Alert';
        } else {
            // Add new alert
            activeAlerts.push({ meterId, param, threshold, message });
        }
        
        localStorage.setItem('activeAlerts', JSON.stringify(activeAlerts));
        
        renderAlerts();
        e.target.reset();
    });

    // Handle deleting or editing alerts (using event delegation on parent)
    activeAlertsList.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('.remove-alert-btn');
        if (targetBtn) {
            const index = targetBtn.getAttribute('data-index');
            activeAlerts.splice(index, 1);
            localStorage.setItem('activeAlerts', JSON.stringify(activeAlerts));
            renderAlerts();
            return;
        }

        const editBtn = e.target.closest('.edit-alert-btn');
        if (editBtn) {
            const index = editBtn.getAttribute('data-index');
            const alertToEdit = activeAlerts[index];
            
            document.getElementById('alertIndex').value = index;
            document.getElementById('alertMeterSelect').value = alertToEdit.meterId;
            document.getElementById('alertParamSelect').value = alertToEdit.param;
            document.getElementById('alertThreshold').value = alertToEdit.threshold;
            document.getElementById('alertMessage').value = alertToEdit.message;
            
            document.getElementById('alertForm').querySelector('button[type="submit"]').innerText = 'Update Alert';
            document.getElementById('alerts-setup-tab').click();
        }
    });

    /**
     * Checks if any live data exceeds the set alert thresholds.
     */
    function checkAlerts(meterId, liveData) {
        activeAlerts.forEach(alert => {
            if (alert.meterId == meterId) {
                const value = liveData[alert.param];
                if (value !== null && value > alert.threshold) {
                    const isNewAlert = !triggeredAlerts.some(a => 
                        a.meterId === alert.meterId && 
                        a.message === alert.message
                    );
                    
                    if (isNewAlert) {
                        const newAlert = {
                            timestamp: liveData.Timestamp,
                            meterId: alert.meterId,
                            message: alert.message
                        };
                        triggeredAlerts.push(newAlert);
                        sessionStorage.setItem('triggeredAlerts', JSON.stringify(triggeredAlerts));
                        renderTriggeredAlerts();
                        showToastAlert(alert.message);
                    }
                }
            }
        });
    }

    /**
     * Shows a Bootstrap toast alert with a message.
     */
    function showToastAlert(message) {
        const toastHtml = `
            <div class="toast align-items-center text-bg-danger border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        🔔 ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;
        const toastElement = document.createElement('div');
        toastElement.innerHTML = toastHtml;
        toastContainer.appendChild(toastElement.firstElementChild);
        
        const toast = new bootstrap.Toast(toastContainer.lastElementChild);
        toast.show();
    }
    
    // Add event listeners for chart modals
    document.getElementById('powerFactorLineChart').parentElement.addEventListener('click', () => {
        if (pfModalChart) pfModalChart.destroy();
        pfModalChart = new Chart(powerFactorModalChartCanvas, pfChart.config);
        const powerFactorModal = new bootstrap.Modal(document.getElementById('powerFactorModal'));
        powerFactorModal.show();
    });

    document.getElementById('currentLineChart').parentElement.addEventListener('click', () => {
        if (currentModalChart) currentModalChart.destroy();
        currentModalChart = new Chart(currentModalChartCanvas, currentChart.config);
        const currentModal = new bootstrap.Modal(document.getElementById('currentModal'));
        currentModal.show();
    });

    // Initial fetch of meters to start the dashboard
    fetchMeters();
});