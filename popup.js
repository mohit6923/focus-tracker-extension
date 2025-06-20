let isFocusModeOn = false;
let isPaused = false;
let sessionStartTime = null;
let userInitiatedStop = false;

document.addEventListener('DOMContentLoaded', function() {
    console.log("Popup loaded at:", new Date().toISOString());
    
    // Set up event listeners
    document.getElementById('toggleFocus').addEventListener('click', toggleFocus);
    document.getElementById('pauseResume').addEventListener('click', togglePause);
    document.getElementById('viewAnalytics').addEventListener('click', openAnalytics);
    
    // Initial state check
    checkSessionStatus();
    
    // Update timer every second
    setInterval(updateTimer, 1000);
    
    // Sync with background and update stats periodically
    setInterval(() => {
        syncWithBackground();
        updateDailyStats();
    }, 5000);
});

function checkSessionStatus() {
    console.log("Checking session status...");
    chrome.storage.local.get(['currentSessionId', 'sessionHistory', 'isPaused'], function(data) {
        console.log("Storage data:", data);
        
        isFocusModeOn = !!data.currentSessionId;
        isPaused = data.isPaused || false;
        
        if (isFocusModeOn) {
            console.log("Found active session:", data.currentSessionId);
            const history = data.sessionHistory || [];
            const currentSession = history.find(session => session.id === data.currentSessionId);
            
            if (currentSession && currentSession.startTime) {
                sessionStartTime = currentSession.startTime;
                console.log("Session start time:", sessionStartTime);
            } else {
                console.log("No start time found for session, using current time");
                sessionStartTime = Date.now();
            }
            
            updateUI();
            updateDailyStats();
            // Update timer immediately after UI update
            updateTimer();
        } else {
            console.log("No active session found");
            sessionStartTime = null;
            updateUI();
            // Update timer immediately after UI update
            updateTimer();
        }
    });
}

function syncWithBackground() {
    if (isFocusModeOn && !userInitiatedStop) {
        console.log("Syncing with background...");
        chrome.storage.local.get(['currentSessionId'], function(data) {
            if (!data.currentSessionId && isFocusModeOn) {
                console.log("Session lost in background, updating UI");
                isFocusModeOn = false;
                sessionStartTime = null;
                updateUI();
            }
        });
    }
}

function updateDailyStats() {
    chrome.storage.local.get('sessionHistory', function(data) {
        const history = data.sessionHistory || [];
        const today = new Date().toDateString();

        const todaySessions = history.filter(s => new Date(s.startTime).toDateString() === today);
        const totalTime = todaySessions.reduce((acc, s) => acc + (s.duration || 0), 0);

        const minutes = Math.floor(totalTime / 60000);
        document.getElementById('todayTime').textContent = `${minutes}m`;
        document.getElementById('todaySessions').textContent = todaySessions.length;
    });
}

function toggleFocus() {
    console.log("Toggle focus clicked. Current state:", isFocusModeOn);
    
    // Disable the button temporarily to prevent double-clicks
    const button = document.getElementById('toggleFocus');
    button.disabled = true;
    
    if (isFocusModeOn) {
        console.log("User initiated stop");
        userInitiatedStop = true;
        stopFocusSession().finally(() => {
            button.disabled = false;
        });
    } else {
        console.log("User initiated start");
        userInitiatedStop = false;
        startFocusSession().finally(() => {
            button.disabled = false;
        });
    }
}

function togglePause() {
    isPaused = !isPaused;
    chrome.storage.local.set({ isPaused: isPaused });
    chrome.runtime.sendMessage({ togglePause: true, isPaused: isPaused });
    updateUI();
}

function startFocusSession() {
    console.log("Starting focus session...");
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({toggleFocus: true, isFocusModeOn: true}, function(response) {
            console.log("Start response:", response);
            if (response && response.success) {
                isFocusModeOn = true;
                sessionStartTime = Date.now();
                userInitiatedStop = false;
                isPaused = false;
                chrome.storage.local.set({ isPaused: false });
                updateUI();
                updateDailyStats();
                resolve();
            } else {
                console.error("Failed to start session:", response);
                reject(new Error("Failed to start session"));
            }
        });
    });
}

function stopFocusSession() {
    console.log("Stopping focus session...");
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({toggleFocus: true, isFocusModeOn: false}, function(response) {
            console.log("Stop response:", response);
            if (response && response.success) {
                isFocusModeOn = false;
                sessionStartTime = null;
                isPaused = false;
                chrome.storage.local.set({ isPaused: false });
                updateUI();
                updateDailyStats();
                resolve();
            } else {
                console.error("Failed to stop session:", response);
                reject(new Error("Failed to stop session"));
            }
        });
    });
}

function updateUI() {
    const toggleButton = document.getElementById('toggleFocus');
    const pauseButton = document.getElementById('pauseResume');
    const statusContainer = document.getElementById('status');
    const statusText = statusContainer.querySelector('.status-text');
    
    if (isFocusModeOn) {
        toggleButton.textContent = 'Stop Focus';
        toggleButton.className = 'btn btn-primary danger';

        statusContainer.className = 'status-badge on';
        statusText.textContent = isPaused ? 'PAUSED' : 'ON';
        
        pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
        pauseButton.style.display = 'block';
    } else {
        toggleButton.textContent = 'Start Focus';
        toggleButton.className = 'btn btn-primary';
        
        statusContainer.className = 'status-badge off';
        statusText.textContent = 'OFF';

        pauseButton.style.display = 'none';
    }
}

function updateTimer() {
    const timerText = document.getElementById('timer');
    
    if (isFocusModeOn && sessionStartTime && !isPaused) {
        const now = Date.now();
        const elapsed = now - sessionStartTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        timerText.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else if (!isFocusModeOn) {
        // Keep consistent format when not in focus mode
        timerText.textContent = '00:00:00';
    }
}

function openAnalytics() {
    chrome.tabs.create({url: 'analytics.html'});
}
