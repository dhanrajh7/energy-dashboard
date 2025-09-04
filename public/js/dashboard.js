// public/js/dashboard.js
document.addEventListener('DOMContentLoaded', () => {
    /* --------------------------------------------------------------
       Global State & UI Elements
     -------------------------------------------------------------- */
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
    
    // The "Clear All Alerts" button is removed from EJS, so its JS variable is no longer needed.
    // const clearAlertsBtn = document.getElementById('clearAlertsBtn');

    let meters = [];
    let kwhChart, pfChart, currentChart, pfModalChart, currentModalChart;

    // Default date range (last 24 hours)
    const defaultEndDate = moment();
    const defaultStartDate = moment().subtract(24, 'hours');
    document.getElementById('chartStartDate').value = defaultStartDate.format('YYYY-MM-DDTHH:mm');
    document.getElementById('chartEndDate').value = defaultEndDate.format('YYYY-MM-DDTHH:mm');
    document.getElementById('eventStartDate').value = defaultStartDate.format('YYYY-MM-DDTHH:mm');
    document.getElementById('eventEndDate').value = defaultEndDate.format('YYYY-MM-DDTHH:mm');

    /* --------------------------------------------------------------
       Initialization and Data Fetching
     -------------------------------------------------------------- */

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

        if (meters.length > 0) chartMeterSelect.value = meters[0].MeterID;

        // Initial loads
        await updateAllMeterCards();
        fetchAndRenderKWHBarChart();
        updateHistoricalCharts();
        fetchAndRenderEvents();
    }

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

    async function fetchLiveData(meterId) {
        const response = await fetch(`/api/live-data/${meterId}`);
        return await response.json();
    }

    /* --------------------------------------------------------------
       Meter Card Rendering (Partial Update)
     -------------------------------------------------------------- */
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
                <span class="value-label">Total KW:</span><span class="value-data">${liveData.Total_KW ? liveData.Total_KW.toFixed(2) : 'N/A'} kW</span>
                <span class="value-label">Total KWH:</span><span class="value-data">${liveData.Total_KWH ? liveData.Total_KWH.toFixed(2) : 'N/A'} kWh</span>
                <span class="value-label">Install Date:</span><span class="value-data">${moment(meter.InstallationDate).format('YYYY-MM-DD')}</span>
              </div>
            `;
        }

        cardCol.innerHTML = `
          <div class="card h-100 shadow-sm">
            <div class="card-header">
              <h5 class="shop-name-box">${meter.Location}</h5>
              <div class="d-flex align-items-center gap-2">
                <span>${meter.MeterID}</span>
                <span class="status-light ${statusLightClass}" title="${statusLightClass === 'status-green' ? 'Online' : 'Offline'}"></span>
              </div>
            </div>
            <div class="card-body">${cardBodyContent}</div>
            <div class="card-footer text-center">
              <small>${lastUpdatedText}</small>
            </div>
          </div>
        `;
    }

    // Auto-refresh meter cards every 5 seconds
    setInterval(updateAllMeterCards, 5000);

    /* --------------------------------------------------------------
       Chart.js Implementations
     -------------------------------------------------------------- */
    async function fetchAndRenderKWHBarChart() {
        const response = await fetch('/api/total-kwh-latest');
        const data = await response.json();

        const labels = data.map(d => `${d.Location} (${d.MeterID})`);
        const kwhData = data.map(d => d.Total_KWH);

        if (kwhChart) kwhChart.destroy();
        kwhChart = new Chart(kwhBarChartCanvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{ label: 'Latest Total KWH', data: kwhData, backgroundColor: 'rgba(97, 175, 239, 0.8)', borderColor: '#61afef', borderWidth: 1 }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Total KWH' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    x: { grid: { color: 'rgba(255,255,255,0.1)' } }
                },
                plugins: { legend: { labels: { color: 'white' } } }
            }
        });
    }

    async function updateHistoricalCharts() {
        const meterId = chartMeterSelect.value;
        const startDate = document.getElementById('chartStartDate').value;
        const endDate = document.getElementById('chartEndDate').value;
        if (!meterId) return;

        const response = await fetch(`/api/historical-data/${meterId}?startDate=${startDate}&endDate=${endDate}`);
        const data = await response.json();

        const labels = data.map(d => moment.utc(d.Timestamp).local().format('HH:mm:ss'));

        if (pfChart) pfChart.destroy();
        pfChart = new Chart(powerFactorLineChartCanvas, {
            type: 'line',
            data: {
                labels,
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
                    x: { title: { display: true, text: 'Time' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Power Factor' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                },
                plugins: { legend: { labels: { color: 'white' } } }
            }
        });

        if (currentChart) currentChart.destroy();
        currentChart = new Chart(currentLineChartCanvas, {
            type: 'line',
            data: {
                labels,
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
                    x: { title: { display: true, text: 'Time' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Current (A)' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                },
                plugins: { legend: { labels: { color: 'white' } } }
            }
        });
    }

    document.getElementById('updateChartsBtn').addEventListener('click', updateHistoricalCharts);
    chartMeterSelect.addEventListener('change', updateHistoricalCharts);

    /* --------------------------------------------------------------
       Event Table
     -------------------------------------------------------------- */
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

    document.getElementById('filterEventsBtn').addEventListener('click', fetchAndRenderEvents);

    /* --------------------------------------------------------------
       Alert System (DB-backed)
     -------------------------------------------------------------- */
    let dbAlertRules = [];
    let dbActiveTriggered = [];

    async function loadAlertRules() {
        const res = await fetch('/api/alerts/rules');
        dbAlertRules = await res.json();
        renderAlertRules();
    }

    async function loadTriggeredAlerts() {
        const res = await fetch('/api/alerts/triggered');
        dbActiveTriggered = await res.json();
        renderTriggeredAlertsFromDB();
    }

    function renderAlertRules() {
        activeAlertsList.innerHTML = '';
        dbAlertRules
            .filter(r => r.IsActive === 1)
            .forEach((r) => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center bg-transparent';
                li.innerHTML = `
                  <div>
                    <strong>Meter ${r.MeterID}</strong>: ${r.Parameter} > ${r.Threshold}
                    <p class="text-muted mb-0 d-inline-block ms-3">${r.Message}</p>
                  </div>
                  <div class="btn-group">
                    <button type="button" class="btn btn-sm btn-info edit-rule-btn" data-id="${r.AlertID}">
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-danger delete-rule-btn" data-id="${r.AlertID}">
                      <i class="bi bi-x-lg"></i>
                    </button>
                  </div>
                `;
                activeAlertsList.appendChild(li);
            });
    }

    function renderTriggeredAlertsFromDB() {
        triggeredAlertsList.innerHTML = '';
        dbActiveTriggered.forEach(a => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center alert-item';
            li.innerHTML = `
              <div>
                <strong>[${moment.utc(a.StartTime).local().format('HH:mm:ss')}] Alert on Meter ${a.MeterID}:</strong>
                <span class="ms-2">${a.Message}</span>
              </div>
            `;
            triggeredAlertsList.appendChild(li);
        });

        if (dbActiveTriggered.length > 0) {
            alertCountBadge.textContent = dbActiveTriggered.length;
            alertCountBadge.classList.remove('d-none');
        } else {
            alertCountBadge.classList.add('d-none');
        }
    }

    // Create or edit rule (PUT on edit so AlertID is preserved)
    let editingAlertId = null;
    document.getElementById('alertForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const MeterID = parseInt(document.getElementById('alertMeterSelect').value, 10);
        const Parameter = document.getElementById('alertParamSelect').value;
        const Threshold = parseFloat(document.getElementById('alertThreshold').value);
        const Message = document.getElementById('alertMessage').value;

        if (editingAlertId) {
            await fetch(`/api/alerts/rules/${editingAlertId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ MeterID, Parameter, Threshold, Message })
            });
            editingAlertId = null;
            document.querySelector('#alertForm button[type="submit"]').innerText = 'Save Alert';
        } else {
            await fetch('/api/alerts/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ MeterID, Parameter, Threshold, Message })
            });
        }

        e.target.reset();
        await loadAlertRules();
        await loadTriggeredAlerts(); // reflect immediate activation/recovery
    });

    // Edit / Delete buttons in rules list
    activeAlertsList.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('.delete-rule-btn');
        if (delBtn) {
            const id = delBtn.getAttribute('data-id');
            await fetch(`/api/alerts/rules/${id}`, { method: 'DELETE' });
            await loadAlertRules();
            await loadTriggeredAlerts();
            return;
        }

        const editBtn = e.target.closest('.edit-rule-btn');
        if (editBtn) {
            const id = parseInt(editBtn.getAttribute('data-id'), 10);
            const r = dbAlertRules.find(x => x.AlertID === id);
            if (!r) return;

            document.getElementById('alertMeterSelect').value = r.MeterID;
            document.getElementById('alertParamSelect').value = r.Parameter;
            document.getElementById('alertThreshold').value = r.Threshold;
            document.getElementById('alertMessage').value = r.Message;

            editingAlertId = id;
            document.querySelector('#alertForm button[type="submit"]').innerText = 'Update Alert';
            document.getElementById('alerts-setup-tab').click();
        }
    });

    // We no longer need the "Clear All Alerts" button. The server will handle recovery automatically.
    // The `clearAlertsBtn` event listener has been removed.

    // Modal charts
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

    /* --------------------------------------------------------------
       Initial boot
     -------------------------------------------------------------- */
    (async () => {
        await loadAlertRules();
        await loadTriggeredAlerts();
        await fetchMeters(); // This also starts the 5s auto-refresh
        setInterval(loadTriggeredAlerts, 5000); // Add a dedicated interval for fetching alerts
    })();
});