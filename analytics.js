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
    displayGoalAnalytics(sessionHistory);
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
        container.innerHTML = "<div class='no-website-data'>No website data to display.</div>";
        return;
    }

    // Calculate overall website stats
    const allWebsites = {};
    let totalTime = 0;
    let uniqueWebsites = new Set();
    
    Object.values(websitesByDay).forEach(dayData => {
        Object.entries(dayData).forEach(([website, time]) => {
            allWebsites[website] = (allWebsites[website] || 0) + time;
            totalTime += time;
            uniqueWebsites.add(website);
        });
    });

    const topWebsite = Object.entries(allWebsites).sort(([,a], [,b]) => b - a)[0];
    const avgTimePerSite = totalTime / uniqueWebsites.size;

    // Create modern website breakdown with header
    container.innerHTML = `
        <div class="website-breakdown">
            <div class="website-header">
                <div class="website-title">Website Analytics</div>
                <div class="website-stats">
                    <div class="website-stat">
                        <div class="website-stat-number">${uniqueWebsites.size}</div>
                        <div class="website-stat-label">Unique Sites</div>
                    </div>
                    <div class="website-stat">
                        <div class="website-stat-number">${formatTime(totalTime, true)}</div>
                        <div class="website-stat-label">Total Time</div>
                    </div>
                    <div class="website-stat">
                        <div class="website-stat-number">${formatTime(avgTimePerSite, true)}</div>
                        <div class="website-stat-label">Avg/Site</div>
                    </div>
                </div>
            </div>

            <div class="day-picker">
                ${dates.map(date => 
                    `<div class="day-chip" data-date="${date}">${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>`
                ).join('')}
            </div>

            <div class="website-breakdown-content">
                <!-- Content will be populated by renderDay function -->
            </div>
        </div>
    `;

    const breakdownContent = container.querySelector('.website-breakdown-content');

    // Add click listeners to day chips
    container.querySelectorAll('.day-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            container.querySelector('.day-chip.active')?.classList.remove('active');
            chip.classList.add('active');
            renderDay(chip.getAttribute('data-date'));
        });
    });

    function renderDay(date) {
        const dayData = websitesByDay[date];
        if (!dayData) {
            breakdownContent.innerHTML = "<div class='no-website-data'>No website data for this day.</div>";
            return;
        }
        
        const categorized = categorizeWebsites(dayData);
        const totalDayTime = Object.values(dayData).reduce((sum, time) => sum + time, 0);
        const totalHours = Math.round(totalDayTime / 3600000 * 10) / 10; // Convert to hours

        breakdownContent.innerHTML = `
            ${Object.entries(categorized).map(([category, sites]) => {
                const sortedSites = Object.entries(sites).sort(([, a], [, b]) => b - a);
                const categoryIcon = getCategoryIcon(category);
                const categoryTime = Object.values(sites).reduce((sum, time) => sum + time, 0);
                
                return `
                    <div class="category-card">
                        <div class="category-header">
                            <div class="category-title">
                                <div class="category-icon">${categoryIcon}</div>
                                ${category}
                            </div>
                        </div>
                        <ul class="website-list">
                            ${sortedSites.map(([site, time]) => {
                                const hours = Math.round(time / 3600000 * 10) / 10;
                                return `
                                    <li class="website-item">
                                        <div class="website-item-content">
                                            <div class="website-info">
                                                <div class="website-name">${site}</div>
                                                <div class="website-meta">
                                                    <span class="website-time">${formatTime(time)} (${hours}h)</span>
                                                </div>
                                            </div>
                                            <div class="progress-container">
                                                <div class="progress-bar-container">
                                                    <div class="progress-bar" style="width: ${Math.round((time / totalDayTime) * 100)}%"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                `;
                            }).join('')}
                        </ul>
                    </div>
                `;
            }).join('')}
        `;
    }

    function calculateFocusScore(dayData) {
        // Calculate focus score based on time distribution
        // Higher score = more time spent on fewer sites (more focused)
        const totalTime = Object.values(dayData).reduce((sum, time) => sum + time, 0);
        const numSites = Object.keys(dayData).length;
        
        if (totalTime === 0 || numSites === 0) return 0;
        
        // Calculate concentration (how much time is spent on top sites)
        const sortedTimes = Object.values(dayData).sort((a, b) => b - a);
        const top3Time = sortedTimes.slice(0, 3).reduce((sum, time) => sum + time, 0);
        const concentration = (top3Time / totalTime) * 100;
        
        // Calculate efficiency (less sites = higher score)
        const efficiency = Math.max(0, 100 - (numSites * 5)); // Penalty for too many sites
        
        // Combine concentration and efficiency
        const focusScore = Math.round((concentration * 0.7) + (efficiency * 0.3));
        
        return Math.min(100, Math.max(0, focusScore));
    }

    // Initial render for the most recent day
    if (dates.length > 0) {
        const firstChip = container.querySelector('.day-chip');
        if (firstChip) {
            firstChip.classList.add('active');
            renderDay(firstChip.getAttribute('data-date'));
        }
    }
}

function getCategoryIcon(category) {
    const icons = {
        'Social Media': 'SM',
        'Video & Entertainment': 'VE',
        'News & Information': 'NI',
        'Developer Tools': 'DT',
        'Shopping': 'SP',
        'Other': 'OT'
    };
    return icons[category] || 'OT';
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
            backgroundColor: [
                '#21d19f', '#00a8cc', '#fa0a6d', '#7c3aed', 
                '#ff7a00', '#ffc107', '#f44336', '#673ab7',
                '#4caf50', '#2196f3', '#ff9800', '#9c27b0'
            ],
            borderColor: '#2a2a4a',
            borderWidth: 2,
            hoverBorderWidth: 3,
            hoverBorderColor: '#ffffff'
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
                    labels: { 
                        color: '#e0e0e0', 
                        font: { size: 12 },
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    } 
                },
                tooltip: {
                    backgroundColor: 'rgba(42, 42, 74, 0.95)',
                    titleColor: '#e0e0e0',
                    bodyColor: '#e0e0e0',
                    borderColor: '#3f3f6c',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            cutout: '60%'
        }
    });
}

function displaySessionsList(sessionHistory) {
    const container = document.getElementById("sessionsList");
    if (!container) return;

    const sortedHistory = [...sessionHistory].sort((a, b) => b.startTime - a.startTime);

    if (sortedHistory.length === 0) {
        container.innerHTML = "<div class='no-data'>No session history to display.</div>";
        return;
    }

    container.innerHTML = sortedHistory.map(session => {
        const { id, startTime, endTime, duration, websites, goals } = session;
        const startDate = new Date(startTime).toLocaleString();
        const endDate = endTime ? new Date(endTime).toLocaleString() : 'In Progress';
        const websitesCount = websites ? Object.keys(websites).length : 0;
        
        // Ensure goals is always an array (for backward compatibility with old sessions)
        const sessionGoals = Array.isArray(goals) ? goals : [];
        
        // Determine session type
        const isGoalBased = sessionGoals.length > 0;
        
        const sessionType = isGoalBased ? 'Goal-Based Session' : 'Quick Start Session';
        const sessionTypeClass = isGoalBased ? 'session-type-goal' : 'session-type-quick';
        
        const goalsHtml = isGoalBased
            ? `<div class="session-goals">
                <div class="goals-header">
                    <strong>Selected Goals (${sessionGoals.length}):</strong>
                </div>
                <div class="goals-list">
                    ${sessionGoals.map(g => {
                        const goalText = typeof g === 'string' ? g : g.text;
                        const targetTime = typeof g === 'object' && g.targetTime ? `<span class="goal-target-time">${g.targetTime}m</span>` : '';
                        return `<span class="goal-tag">${goalText}${targetTime}</span>`;
                    }).join('')}
                </div>
               </div>`
            : '';

        return `
            <div class="session-item" data-session-id="${id}">
                <div class="session-header">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div class="session-time">${startDate}</div>
                        <div class="session-duration">${formatTime(duration)}</div>
                    </div>
                    <div class="session-type-badge ${sessionTypeClass}">
                        ${isGoalBased ? 'GOAL BASED' : 'QUICK START'}
                    </div>
                </div>
                <div class="session-summary">
                    ${goalsHtml}
                    <div class="session-meta">
                        <span>Ended: ${endDate}</span> |
                        <span>Websites visited: ${websitesCount}</span>
                    </div>
                </div>
                <div class="session-details">
                    <ul class="website-list">
                        ${websites ? Object.entries(websites).map(([site, time]) => `
                            <li class="website-item">
                                <span>${site}</span>
                                <span>${formatTime(time)}</span>
                            </li>
                        `).join('') : '<li>No website data tracked.</li>'}
                    </ul>
                </div>
            </div>
        `;
    }).join('');

    // Add click listeners to toggle details
    container.querySelectorAll('.session-item').forEach(item => {
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

function displayGoalAnalytics(sessionHistory) {
    const container = document.getElementById('goalAnalyticsContainer');
    if (!container) return;

    // Get all goal-based sessions
    const goalSessions = sessionHistory.filter(session => 
        session.goals && Array.isArray(session.goals) && session.goals.length > 0
    );

    if (goalSessions.length === 0) {
        container.innerHTML = "<div class='no-goal-data'>No goal-based sessions found. Start a goal-based session to see analytics here.</div>";
        return;
    }

    // Analyze goals
    const goalStats = analyzeGoals(goalSessions);
    
    container.innerHTML = `
        <div class="goal-analytics-container">
            <div class="goal-header">
                <div class="goal-title">Goal Performance Analytics</div>
                <div class="goal-stats">
                    <div class="goal-stat">
                        <div class="goal-stat-number">${goalStats.totalGoals}</div>
                        <div class="goal-stat-label">Goals Tackled</div>
                    </div>
                    <div class="goal-stat">
                        <div class="goal-stat-number">${goalStats.completedGoals}</div>
                        <div class="goal-stat-label">Goals Completed</div>
                    </div>
                    <div class="goal-stat">
                        <div class="goal-stat-number">${goalStats.completionRate}%</div>
                        <div class="goal-stat-label">Success Rate</div>
                    </div>
                    <div class="goal-stat">
                        <div class="goal-stat-number">${goalStats.avgTargetTime}m</div>
                        <div class="goal-stat-label">Avg. Target Time</div>
                    </div>
                </div>
            </div>

            <div class="goal-chart-section">
                <h4>Goal Completion Over Time</h4>
                <canvas id="goalChart" width="400" height="200"></canvas>
            </div>
            
            <div class="goal-performance-section">
                <h4>Goal Performance Breakdown</h4>
                <div class="goal-performance-list">
                    ${goalStats.goalBreakdown.map(goal => `
                        <div class="goal-performance-item">
                            <div class="goal-info">
                                <div class="goal-name">${goal.text}</div>
                                <div class="goal-meta">
                                    <span class="goal-sessions">${goal.sessions} sessions</span>
                                    ${goal.targetTime ? `<span class="goal-target">Target: ${goal.targetTime}m</span>` : ''}
                                </div>
                            </div>
                            <div class="goal-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${goal.completionRate}%"></div>
                                </div>
                                <div class="progress-text">${goal.completionRate}%</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    // Render goal completion chart
    renderGoalChart(goalSessions);
}

function analyzeGoals(sessions) {
    const goalMap = new Map();
    let totalGoals = 0;
    let completedGoals = 0;
    let totalTargetTime = 0;
    let targetTimeCount = 0;

    sessions.forEach(session => {
        session.goals.forEach(goal => {
            const goalText = typeof goal === 'string' ? goal : goal.text;
            const targetTime = typeof goal === 'object' && goal.targetTime ? goal.targetTime : null;
            
            if (!goalMap.has(goalText)) {
                goalMap.set(goalText, {
                    text: goalText,
                    sessions: 0,
                    targetTime: targetTime,
                    totalTime: 0
                });
            }
            
            const goalData = goalMap.get(goalText);
            goalData.sessions++;
            goalData.totalTime += session.duration || 0;
            
            if (targetTime) {
                totalTargetTime += targetTime;
                targetTimeCount++;
            }
            
            totalGoals++;
        });
    });

    // Calculate completion rates
    const goalBreakdown = Array.from(goalMap.values()).map(goal => {
        const completionRate = goal.targetTime ? 
            Math.min(100, Math.round((goal.totalTime / (goal.targetTime * 60000)) * 100)) : 
            Math.round((goal.sessions / sessions.length) * 100);
        
        if (completionRate >= 100) completedGoals++;
        
        return {
            ...goal,
            completionRate
        };
    });

    return {
        totalGoals,
        completedGoals,
        completionRate: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0,
        avgTargetTime: targetTimeCount > 0 ? Math.round(totalTargetTime / targetTimeCount) : 0,
        goalBreakdown: goalBreakdown.sort((a, b) => b.completionRate - a.completionRate)
    };
}

function renderGoalChart(goalSessions) {
    const ctx = document.getElementById('goalChart');
    if (!ctx) return;

    // Group sessions by date and calculate daily goal completion
    const dailyData = {};
    goalSessions.forEach(session => {
        const date = new Date(session.startTime).toLocaleDateString();
        if (!dailyData[date]) {
            dailyData[date] = { total: 0, completed: 0 };
        }
        
        session.goals.forEach(goal => {
            const targetTime = typeof goal === 'object' && goal.targetTime ? goal.targetTime : null;
            const sessionDuration = session.duration || 0;
            
            dailyData[date].total++;
            if (targetTime && (sessionDuration / 60000) >= targetTime) {
                dailyData[date].completed++;
            }
        });
    });

    const labels = Object.keys(dailyData);
    const completionRates = labels.map(date => {
        const data = dailyData[date];
        return data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
    });

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Goal Completion Rate (%)',
                data: completionRates,
                borderColor: '#21d19f',
                backgroundColor: 'rgba(33, 209, 159, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#21d19f',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#e0e0e0'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: '#a7a7a7',
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: 'rgba(167, 167, 167, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#a7a7a7'
                    },
                    grid: {
                        color: 'rgba(167, 167, 167, 0.1)'
                    }
                }
            }
        }
    });
}
