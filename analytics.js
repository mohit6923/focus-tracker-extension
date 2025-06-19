document.addEventListener("DOMContentLoaded", function () {
    console.log("Analytics page loaded");
    
    const loadingMessage = document.getElementById("loadingMessage");
    const mainContent = document.getElementById("mainContent");
    
    // Check if Chart.js loaded properly
    if (typeof Chart === 'undefined') {
        console.error("Chart.js not loaded!");
        loadingMessage.innerHTML = "Error: Chart.js library failed to load. Please check your internet connection.";
        return;
    }
    
    chrome.storage.local.get(["sessionHistory", "focusSessionData"], function (data) {
        console.log("Retrieved data:", data);
        
        const sessionHistory = data.sessionHistory || [];
        const currentSessionData = data.focusSessionData || {};
        
        if (sessionHistory.length === 0) {
            loadingMessage.innerHTML = "<div class='no-data'>No focus sessions found. Start a focus session to see analytics here.</div>";
            return;
        }
        
        // Hide loading and show content
        loadingMessage.style.display = "none";
        mainContent.style.display = "block";
        
        // Process and display analytics
        displayAnalytics(sessionHistory, currentSessionData);
    });
});

function displayAnalytics(sessionHistory, currentSessionData) {
    // Calculate statistics
    const stats = calculateStats(sessionHistory);
    updateStatsCards(stats);
    
    // Create charts
    createDailyChart(sessionHistory);
    createDurationChart(sessionHistory);
    createWebsitesChart(sessionHistory);
    
    // Display sessions list
    displaySessionsList(sessionHistory);
}

function calculateStats(sessionHistory) {
    const totalSessions = sessionHistory.length;
    const totalTime = sessionHistory.reduce((sum, session) => sum + (session.duration || 0), 0);
    const avgSessionTime = totalSessions > 0 ? totalTime / totalSessions : 0;
    
    // Get unique websites
    const allWebsites = new Set();
    sessionHistory.forEach(session => {
        if (session.websites) {
            Object.keys(session.websites).forEach(website => allWebsites.add(website));
        }
    });
    
    return {
        totalSessions,
        totalTime,
        avgSessionTime,
        uniqueWebsites: allWebsites.size
    };
}

function updateStatsCards(stats) {
    document.getElementById("totalSessions").textContent = stats.totalSessions;
    document.getElementById("totalTime").textContent = formatTime(stats.totalTime);
    document.getElementById("avgSessionTime").textContent = formatTime(stats.avgSessionTime, true);
    document.getElementById("uniqueWebsites").textContent = stats.uniqueWebsites;
}

function createDailyChart(sessionHistory) {
    const dailyData = {};
    
    sessionHistory.forEach(session => {
        if (session.startTime) {
            const date = new Date(session.startTime).toDateString();
            const duration = session.duration || 0;
            
            if (dailyData[date]) {
                dailyData[date] += duration;
            } else {
                dailyData[date] = duration;
            }
        }
    });
    
    const labels = Object.keys(dailyData).map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const data = Object.values(dailyData).map(duration => duration / (1000 * 60)); // Convert to minutes
    
    const ctx = document.getElementById("dailyChart").getContext("2d");
    new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Focus Time (minutes)",
                data: data,
                backgroundColor: "#2196F3",
                borderColor: "#1976D2",
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Minutes"
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function createDurationChart(sessionHistory) {
    const durations = sessionHistory
        .filter(session => session.duration)
        .map(session => session.duration / (1000 * 60)); // Convert to minutes
    
    if (durations.length === 0) return;
    
    // Create duration ranges
    const ranges = [
        { min: 0, max: 15, label: "0-15 min" },
        { min: 15, max: 30, label: "15-30 min" },
        { min: 30, max: 60, label: "30-60 min" },
        { min: 60, max: 120, label: "1-2 hours" },
        { min: 120, max: Infinity, label: "2+ hours" }
    ];
    
    const rangeCounts = ranges.map(range => {
        return durations.filter(duration => 
            duration >= range.min && duration < range.max
        ).length;
    });
    
    const labels = ranges.map(range => range.label);
    
    const ctx = document.getElementById("durationChart").getContext("2d");
    new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: rangeCounts,
                backgroundColor: [
                    "#FF6384",
                    "#36A2EB",
                    "#FFCE56",
                    "#4BC0C0",
                    "#9966FF"
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function createWebsitesChart(sessionHistory) {
    const websiteData = {};
    
    sessionHistory.forEach(session => {
        if (session.websites) {
            Object.entries(session.websites).forEach(([website, time]) => {
                if (websiteData[website]) {
                    websiteData[website] += time;
                } else {
                    websiteData[website] = time;
                }
            });
        }
    });
    
    // Sort by time and take top 10
    const sortedWebsites = Object.entries(websiteData)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
    
    const labels = sortedWebsites.map(([website]) => website);
    const data = sortedWebsites.map(([, time]) => time / (1000 * 60)); // Convert to minutes
    
    const ctx = document.getElementById("websitesChart").getContext("2d");
    new Chart(ctx, {
        type: "horizontalBar",
        data: {
            labels: labels,
            datasets: [{
                label: "Time Spent (minutes)",
                data: data,
                backgroundColor: "#2196F3"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Minutes"
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function displaySessionsList(sessionHistory) {
    const sessionsList = document.getElementById("sessionsList");
    
    if (sessionHistory.length === 0) {
        sessionsList.innerHTML = "<div class='no-data'>No sessions found</div>";
        return;
    }
    
    // Sort sessions by start time (newest first)
    const sortedSessions = sessionHistory
        .filter(session => session.startTime)
        .sort((a, b) => b.startTime - a.startTime);
    
    sessionsList.innerHTML = sortedSessions.map((session, index) => {
        const startTime = new Date(session.startTime);
        const endTime = session.endTime ? new Date(session.endTime) : null;
        const duration = session.duration || 0;
        
        const websites = session.websites ? Object.keys(session.websites) : [];
        const topWebsites = websites.slice(0, 3).join(", ");
        
        return `
            <div class="session-item" onclick="toggleSessionDetails(${index})">
                <div class="session-header">
                    <div class="session-time">${startTime.toLocaleString()}</div>
                    <div class="session-duration">${formatTime(duration)}</div>
                </div>
                <div class="session-websites">
                    ${websites.length > 0 ? `Visited: ${topWebsites}${websites.length > 3 ? '...' : ''}` : 'No websites tracked'}
                </div>
                <div class="session-details" id="session-${index}">
                    <h4>Session Details</h4>
                    <p><strong>Start:</strong> ${startTime.toLocaleString()}</p>
                    ${endTime ? `<p><strong>End:</strong> ${endTime.toLocaleString()}</p>` : ''}
                    <p><strong>Duration:</strong> ${formatTime(duration)}</p>
                    ${websites.length > 0 ? `
                        <h5>Websites Visited:</h5>
                        <ul class="website-list">
                            ${Object.entries(session.websites)
                                .sort(([,a], [,b]) => b - a)
                                .map(([website, time]) => `
                                    <li class="website-item">
                                        <span>${website}</span>
                                        <span>${formatTime(time)}</span>
                                    </li>
                                `).join('')}
                        </ul>
                    ` : '<p>No websites tracked during this session</p>'}
                </div>
            </div>
        `;
    }).join('');
}

function toggleSessionDetails(index) {
    const detailsElement = document.getElementById(`session-${index}`);
    detailsElement.classList.toggle('active');
}

function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    // Add active class to clicked tab
    event.target.classList.add('active');
}

function formatTime(milliseconds, short = false) {
    if (!milliseconds || milliseconds === 0) return "0m";
    
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (short) {
        return `${minutes}m`;
    }
    
    if (hours > 0) {
        return `${hours}h ${remainingMinutes}m`;
    } else {
        return `${minutes}m`;
    }
}
