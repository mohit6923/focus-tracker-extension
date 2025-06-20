let isFocusModeOn = false;
let sessionStartTime = null;
let sessionTimer = null;
let userInitiatedStop = false;

document.addEventListener('DOMContentLoaded', function() {
    console.log("Popup loaded at:", new Date().toISOString());
    
    // Check current session status
    checkSessionStatus();
    
    // Set up event listeners
    document.getElementById('toggleFocus').addEventListener('click', toggleFocus);
    document.getElementById('viewAnalytics').addEventListener('click', openAnalytics);
    
    // Update timer immediately and then every second
    updateTimer();
    setInterval(updateTimer, 1000);
    
    // Sync with background every 5 seconds
    setInterval(syncWithBackground, 5000);
});

function checkSessionStatus() {
    console.log("Checking session status...");
    chrome.storage.local.get(['currentSessionId', 'sessionHistory'], function(data) {
        console.log("Storage data:", data);
        
        if (data.currentSessionId) {
            console.log("Found active session:", data.currentSessionId);
            isFocusModeOn = true;
            
            // Find the session in history to get start time
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
            // Update timer immediately after UI update
            updateTimer();
        } else {
            console.log("No active session found");
            isFocusModeOn = false;
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

function startFocusSession() {
    console.log("Starting focus session...");
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({toggleFocus: true, isFocusModeOn: true}, function(response) {
            console.log("Start response:", response);
            if (response && response.success) {
                isFocusModeOn = true;
                sessionStartTime = Date.now();
                userInitiatedStop = false;
                updateUI();
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
                updateUI();
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
    const statusText = document.getElementById('status');
    const timerText = document.getElementById('timer');
    
    if (isFocusModeOn) {
        toggleButton.textContent = 'Stop Focus';
        toggleButton.className = 'btn btn-danger';
        statusText.textContent = 'Focus Mode: ON';
        statusText.className = 'text-success';
    } else {
        toggleButton.textContent = 'Start Focus';
        toggleButton.className = 'btn btn-success';
        statusText.textContent = 'Focus Mode: OFF';
        statusText.className = 'text-danger';
        timerText.textContent = '00:00:00';
    }
}

function updateTimer() {
    const timerText = document.getElementById('timer');
    
    if (isFocusModeOn && sessionStartTime) {
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
