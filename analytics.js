document.addEventListener("DOMContentLoaded", function () {
    if (typeof Chart === 'undefined') {
        document.body.innerHTML = "Error: Chart.js failed to load.";
        return;
    }
    
    setupTabSwitching();
    
    chrome.storage.local.get("sessionHistory", function (data) {
        const loadingMessage = document.getElementById("loadingMessage");
        const mainContent = document.getElementById("mainContent");
        const sessionHistory = data.sessionHistory || [];
        
        if (sessionHistory.length === 0) {
            loadingMessage.innerHTML = "<div class='no-data'>No focus sessions found. Start a focus session to see analytics here.</div>";
            return;
        }
        
        loadingMessage.style.display = "none";
        mainContent.style.display = "block";
        
        displayAnalytics(sessionHistory);
    });
});

function setupTabSwitching() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            
            document.getElementById(tabName).classList.add('active');
            this.classList.add('active');
        });
    });
}

function displayAnalytics(sessionHistory) {
    const stats = calculateStats(sessionHistory);
    updateStatsCards(stats);
    
    renderDailyFocusChart(sessionHistory);
    renderSessionDurationChart(sessionHistory);
    renderWebsiteChart(sessionHistory);
    
    displaySessionsList(sessionHistory);
    displayWebsiteBreakdown(sessionHistory);
}

function displayWebsiteBreakdown(sessions) {
    const container = document.getElementById('websiteByDayContainer');
    if (!container) return;

    const websitesByDay = sessions.reduce((acc, session) => {
        if (!session.startTime || !session.websites) return acc;
        const date = new Date(session.startTime).toDateString();
        if (!acc[date]) {
            acc[date] = {};
        }
        for (const [website, time] of Object.entries(session.websites)) {
            acc[date][website] = (acc[date][website] || 0) + time;
        }
        return acc;
    }, {});

    const dates = Object.keys(websitesByDay).sort((a, b) => new Date(b) - new Date(a));
    if (dates.length === 0) {
        container.innerHTML = "<div class='no-data'>No website data to display.</div>";
        return;
    }

    // Create horizontal day picker
    const dayPicker = document.createElement('div');
    dayPicker.className = 'day-picker';
    dayPicker.innerHTML = dates.map(date => 
        `<div class="day-chip" data-date="${date}">${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>`
    ).join('');
    container.innerHTML = ''; // Clear previous content
    container.appendChild(dayPicker);

    const breakdownContent = document.createElement('div');
    breakdownContent.className = 'website-breakdown';
    container.appendChild(breakdownContent);

    dayPicker.querySelectorAll('.day-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            dayPicker.querySelector('.active')?.classList.remove('active');
            chip.classList.add('active');
            renderDay(chip.getAttribute('data-date'));
        });
    });

    function renderDay(date) {
        const dayData = websitesByDay[date];
        if (!dayData) {
            breakdownContent.innerHTML = "<div class='no-data'>No website data for this day.</div>";
            return;
        }
        const categorized = categorizeWebsites(dayData);
        
        const maxTimePerSite = Math.max(...Object.values(dayData), 0);

        breakdownContent.innerHTML = Object.entries(categorized).map(([category, sites]) => {
            const sortedSites = Object.entries(sites).sort(([, a], [, b]) => b - a);
            return `
                <div class="category-card">
                    <div class="category-header">
                        <h4 class="category-title">${category}</h4>
                    </div>
                    <ul class="website-list">
                        ${sortedSites.map(([site, time]) => `
                            <li class="website-item">
                                <div class="website-info">
                                    <span class="website-name">${site}</span>
                                    <div class="progress-bar-container">
                                        <div class="progress-bar" style="width: ${(time / maxTimePerSite) * 100}%"></div>
                                    </div>
                                </div>
                                <span class="website-time">${formatTime(time)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }).join('');
    }

    // Initial render for the most recent day
    if (dates.length > 0) {
        const firstChip = dayPicker.querySelector('.day-chip');
        if (firstChip) {
            firstChip.classList.add('active');
            renderDay(firstChip.getAttribute('data-date'));
        }
    }
}

function categorizeWebsites(websiteData) {
    const categories = {
        'Social Media': ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'reddit.com'],
        'Video & Entertainment': ['youtube.com', 'netflix.com', 'hulu.com', 'twitch.tv'],
        'News & Information': ['cnn.com', 'nytimes.com', 'bbc.com', 'wikipedia.org'],
        'Developer Tools': ['github.com', 'stackoverflow.com', 'developer.mozilla.org'],
        'Shopping': ['amazon.com', 'ebay.com', 'walmart.com'],
        'Other': []
    };

    const categorizedData = {};
    for (const [site, time] of Object.entries(websiteData)) {
        let category = 'Other';
        for (const [cat, domains] of Object.entries(categories)) {
            if (domains.some(domain => site.includes(domain))) {
                category = cat;
                break;
            }
        }
        if (!categorizedData[category]) {
            categorizedData[category] = {};
        }
        categorizedData[category][site] = time;
    }
    return categorizedData;
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

function renderDailyFocusChart(sessions) {
    if (!document.getElementById('dailyFocusChart')) return;

    // Calculate the date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0); // Set to the beginning of the day

    // Filter sessions to include only the last 7 days
    const recentSessions = sessions.filter(session => {
        return session.startTime && new Date(session.startTime) >= sevenDaysAgo;
    });

    const dailyData = recentSessions.reduce((acc, session) => {
        if (!session.duration) return acc;
        const date = new Date(session.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        acc[date] = (acc[date] || 0) + session.duration;
        return acc;
    }, {});

    const chartData = {
        labels: Object.keys(dailyData),
        datasets: [{
            label: 'Total Focus Time (minutes)',
            data: Object.values(dailyData).map(d => (d / 60000).toFixed(2)),
            backgroundColor: '#00a8cc',
            borderColor: '#00a8cc',
            borderWidth: 1,
            borderRadius: 4
        }]
    };

    const ctx = document.getElementById('dailyFocusChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { beginAtZero: true, ticks: { color: '#a7a7a7' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                x: { ticks: { color: '#a7a7a7' }, grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderSessionDurationChart(sessions) {
    if (!document.getElementById('sessionDurationChart')) return;
    const validSessions = sessions.filter(s => s.duration && s.startTime);
    if (validSessions.length === 0) return;

    const durations = validSessions.map(s => s.duration / 60000);
    const labels = validSessions.map(s => new Date(s.startTime).toLocaleString());

    const chartData = {
        labels: labels,
        datasets: [{
            label: 'Session Duration (minutes)',
            data: durations,
            backgroundColor: 'rgba(250, 10, 109, 0.2)',
            borderColor: '#fa0a6d',
            pointBackgroundColor: '#fa0a6d',
            fill: true,
            tension: 0.4
        }]
    };

    const ctx = document.getElementById('sessionDurationChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: { 
                y: { beginAtZero: true, ticks: { color: '#a7a7a7' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                x: { ticks: { color: '#a7a7a7' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderWebsiteChart(sessions) {
    if (!document.getElementById('websiteChart')) return;
    const websiteData = sessions.reduce((acc, session) => {
        if (session.websites) {
            for (const [website, time] of Object.entries(session.websites)) {
                acc[website] = (acc[website] || 0) + time;
            }
        }
        return acc;
    }, {});

    const sortedWebsites = Object.entries(websiteData)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8);

    if (sortedWebsites.length === 0) return;

    const chartData = {
        labels: sortedWebsites.map(([website]) => website),
        datasets: [{
            label: 'Time Spent (minutes)',
            data: sortedWebsites.map(([, time]) => (time / 60000).toFixed(2)),
            backgroundColor: ['#00a8cc', '#fa0a6d', '#7c3aed', '#ff7a00', '#21d19f', '#ffc107', '#f44336', '#673ab7'],
            borderWidth: 0
        }]
    };

    const ctx = document.getElementById('websiteChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'right',
                    labels: { color: '#e0e0e0', font: { size: 14 } } 
                }
            }
        }
    });
}

function displaySessionsList(sessionHistory) {
    const sessionsList = document.getElementById("sessionsList");
    if (!sessionsList) return;
    
    if (sessionHistory.length === 0) {
        sessionsList.innerHTML = "<div class='no-data'>No sessions found</div>";
        return;
    }
    
    const sortedSessions = sessionHistory
        .filter(session => session.startTime)
        .sort((a, b) => b.startTime - a.startTime);
    
    sessionsList.innerHTML = sortedSessions.map((session) => {
        const startTime = new Date(session.startTime);
        const endTime = session.endTime ? new Date(session.endTime) : null;
        const duration = session.duration || 0;
        
        const websites = session.websites ? Object.keys(session.websites) : [];
        const topWebsites = websites.slice(0, 3).join(", ");
        
        return `
            <div class="session-item">
                <div class="session-header">
                    <span class="session-time">${startTime.toLocaleString()}</span>
                    <span class="session-duration">${formatTime(duration)}</span>
                </div>
                <div class="session-summary">
                    ${websites.length > 0 ? `Visited ${websites.length} sites: ${topWebsites}${websites.length > 3 ? '...' : ''}` : 'No websites tracked'}
                </div>
                <div class="session-details">
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

    // Add proper event listeners after content is rendered
    sessionsList.querySelectorAll('.session-item').forEach(item => {
        item.addEventListener('click', () => {
            const details = item.querySelector('.session-details');
            if (details) {
                details.classList.toggle('active');
            }
        });
    });
}

function formatTime(milliseconds, short = false) {
    if (milliseconds < 60000) {
        const seconds = Math.round(milliseconds / 1000);
        return short ? `${seconds}s` : `${seconds} sec`;
    }
    const minutes = Math.round(milliseconds / 60000);
    return short ? `${minutes}m` : `${minutes} min`;
}
