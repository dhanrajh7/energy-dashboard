// public/js/dashboard.js

// Tab and view management
function showTab(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('d-none'));
    document.getElementById(tabId).classList.remove('d-none');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    element.classList.add('active');

    if (tabId === 'charts-view') {
        updateCharts(101); // Default to Meter 101 for the charts tab
    } else if (tabId === 'events-view') {
        fetchEvents();
    }
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    updateAllMeters();
});

// Chart instances
let kwhChart, kwChart, currentChart;
const chartOptions = { responsive: true, maintainAspectRatio: false };

// Update all meter cards
async function updateAllMeters() {
    const meterCards = document.querySelectorAll('.card[data-meter-id]');
    meterCards.forEach(card => {
        const meterId = card.dataset.meterId;
        fetchLiveData(meterId, card);
    });
}

// Fetch and update a single meter card
async function fetchLiveData(meterId, cardElement) {
    try {
        const response = await fetch(`/api/live-data/${meterId}`);
        const result = await response.json();
        const statusIndicator = cardElement.querySelector('.status-indicator');
        
        // Reset status classes
        statusIndicator.classList.remove('status-online', 'status-offline', 'status-no-data');

        if (result.status === 'online' || result.status === 'offline') {
            const data = result.data;
            cardElement.querySelector('.avg-current').textContent = data.AvgCurrent !== null ? data.AvgCurrent.toFixed(2) : 'N/A';
            cardElement.querySelector('.avg-voltage').textContent = data.AvgVoltage !== null ? data.AvgVoltage.toFixed(2) : 'N/A';
            cardElement.querySelector('.avg-pf').textContent = data.AvgPowerFactor !== null ? data.AvgPowerFactor.toFixed(2) : 'N/A';
            cardElement.querySelector('.total-kw').textContent = data.Total_KW !== null ? data.Total_KW.toFixed(2) : 'N/A';
            cardElement.querySelector('.total-kwh').textContent = data.Total_KWH !== null ? data.Total_KWH.toFixed(2) : 'N/A';
            
            // Set indicator color based on status
            if (result.status === 'online') {
                statusIndicator.classList.add('status-online');
            } else {
                statusIndicator.classList.add('status-offline');
            }
        } else { // status === 'no_data'
            cardElement.querySelector('.avg-current').textContent = 'N/A';
            cardElement.querySelector('.avg-voltage').textContent = 'N/A';
            cardElement.querySelector('.avg-pf').textContent = 'N/A';
            cardElement.querySelector('.total-kw').textContent = 'N/A';
            cardElement.querySelector('.total-kwh').textContent = 'N/A';
            statusIndicator.classList.add('status-no-data');
        }
    } catch (error) {
        console.error('Error fetching live data:', error);
    }
}

// Chart data fetching and rendering
async function updateCharts(meterId) {
    try {
        const response = await fetch(`/api/historical-data/${meterId}`);
        const data = await response.json();
        const timestamps = data.map(d => new Date(d.Timestamp).toLocaleString());
        const kwhData = data.map(d => d.Total_KWH);
        const kwData = data.map(d => d.Total_KW);
        const currentL1Data = data.map(d => d.Current_L1);
        const currentL2Data = data.map(d => d.Current_L2);
        const currentL3Data = data.map(d => d.Current_L3);

        if (kwhChart) kwhChart.destroy();
        if (kwChart) kwChart.destroy();
        if (currentChart) currentChart.destroy();

        kwhChart = new Chart(document.getElementById('kwhChart'), {
            type: 'line',
            data: {
                labels: timestamps,
                datasets: [{ label: 'Total KWH', data: kwhData, borderColor: '#0d6efd', tension: 0.1 }]
            },
            options: chartOptions
        });

        kwChart = new Chart(document.getElementById('kwChart'), {
            type: 'line',
            data: {
                labels: timestamps,
                datasets: [{ label: 'Total KW', data: kwData, borderColor: '#20c997', tension: 0.1 }]
            },
            options: chartOptions
        });

        currentChart = new Chart(document.getElementById('currentChart'), {
            type: 'line',
            data: {
                labels: timestamps,
                datasets: [
                    { label: 'Current L1', data: currentL1Data, borderColor: '#dc3545', tension: 0.1 },
                    { label: 'Current L2', data: currentL2Data, borderColor: '#ffc107', tension: 0.1 },
                    { label: 'Current L3', data: currentL3Data, borderColor: '#17a2b8', tension: 0.1 }
                ]
            },
            options: chartOptions
        });
    } catch (error) {
        console.error('Error rendering charts:', error);
    }
}

// Event table filtering
document.getElementById('events-filter-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    fetchEvents();
});

async function fetchEvents() {
    try {
        const formData = new FormData(document.getElementById('events-filter-form'));
        const params = new URLSearchParams(formData).toString();
        const response = await fetch(`/api/events?${params}`);
        const events = await response.json();
        const tableBody = document.getElementById('events-table-body');
        tableBody.innerHTML = '';
        events.forEach(event => {
            const row = `<tr>
                <td>${event.EventID}</td>
                <td>${event.MeterID}</td>
                <td>${new Date(event.Timestamp).toLocaleString()}</td>
                <td>${event.AvgCurrent}</td>
                <td>${event.Total_KWH}</td>
            </tr>`;
            tableBody.innerHTML += row;
        });
    } catch (error) {
        console.error('Error fetching events:', error);
    }
}

// Alert logic
const alertToast = new bootstrap.Toast(document.getElementById('alertToast'));
const toastMessage = document.getElementById('toast-message');
let alertRules = [];

function checkAlerts(meterId, data) {
    alertRules.forEach(rule => {
        if (parseInt(rule.meterId) === parseInt(meterId) && parseFloat(data[rule.parameter]) > parseFloat(rule.value)) {
            toastMessage.textContent = rule.message;
            alertToast.show();
        }
    });
}

document.getElementById('saveAlertBtn').addEventListener('click', () => {
    const meterId = document.getElementById('alertMeterId').value;
    const parameter = document.getElementById('alertParameter').value;
    const value = document.getElementById('alertValue').value;
    const message = document.getElementById('alertMessage').value;

    if (meterId && parameter && value && message) {
        const newRule = { meterId, parameter, value: parseFloat(value), message };
        alertRules.push(newRule);
        renderAlerts();
        toastMessage.textContent = 'Alert rule saved!';
        alertToast.show();
    }
});

function renderAlerts() {
    const alertsList = document.getElementById('configured-alerts');
    alertsList.innerHTML = '';
    alertRules.forEach((rule, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.textContent = `Meter ${rule.meterId}: Alert if ${rule.parameter} > ${rule.value} (${rule.message})`;
        alertsList.appendChild(li);
    });
}

// Poll for live data every 5 seconds
setInterval(updateAllMeters, 5000);