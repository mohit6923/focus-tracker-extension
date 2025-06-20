let isFocusModeOn = false;
let isPaused = false;
let sessionStartTime = null;
let userInitiatedStop = false;

document.addEventListener('DOMContentLoaded', function() {
    console.log("Popup loaded at:", new Date().toISOString());
    
    // Set up event listeners
    document.getElementById('quickStart').addEventListener('click', () => {
        startFocusSession([], function() {
            isFocusModeOn = true;
            userInitiatedStop = false;
            isPaused = false;
            chrome.storage.local.set({ isPaused: false });
            updateUI();
            updateDailyStats();
            updateTimer();
        });
    });
    document.getElementById('goalStart').addEventListener('click', showGoalScreen);
    document.getElementById('stopFocus').addEventListener('click', stopFocusSession);
    document.getElementById('pauseResume').addEventListener('click', togglePause);
    document.getElementById('viewAnalytics').addEventListener('click', openAnalytics);

    // Goal screen event listeners
    document.getElementById('back-to-main').addEventListener('click', showMainScreen);
    document.getElementById('add-goal-btn').addEventListener('click', addNewGoal);
    document.getElementById('new-goal-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addNewGoal();
        }
    });
    document.getElementById('start-goal-session').addEventListener('click', startGoalBasedSession);

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

function togglePause() {
    isPaused = !isPaused;
    chrome.storage.local.set({ isPaused: isPaused });
    chrome.runtime.sendMessage({ togglePause: true, isPaused: isPaused });
    updateUI();
}

function showGoalScreen() {
    document.getElementById('start-controls').style.display = 'none';
    document.getElementById('goal-controls').style.display = 'block';
    loadGoals();
}

function showMainScreen() {
    document.getElementById('goal-controls').style.display = 'none';
    document.getElementById('start-controls').style.display = 'block';
}

function loadGoals() {
    chrome.storage.local.get('focusGoals', function(data) {
        const goals = data.focusGoals || [];
        const goalListContainer = document.getElementById('goal-list-container');
        goalListContainer.innerHTML = '';
        goals.forEach(goal => {
            const goalEl = createGoalElement(goal.text, goal.id, goal.targetTime);
            goalListContainer.appendChild(goalEl);
        });
        updateGoalSessionButton();
    });
}

function addNewGoal() {
    const input = document.getElementById('new-goal-input');
    const targetTimeInput = document.getElementById('target-time-input');
    const goalText = input.value.trim();
    const targetTime = targetTimeInput.value ? parseInt(targetTimeInput.value) : null;
    
    if (goalText) {
        chrome.storage.local.get('focusGoals', function(data) {
            const goals = data.focusGoals || [];
            const newGoal = { 
                id: Date.now(), 
                text: goalText,
                targetTime: targetTime
            };
            goals.push(newGoal);
            chrome.storage.local.set({ focusGoals: goals }, function() {
                const goalEl = createGoalElement(newGoal.text, newGoal.id, newGoal.targetTime);
                document.getElementById('goal-list-container').appendChild(goalEl);
                input.value = '';
                targetTimeInput.value = '';
                updateGoalSessionButton();
            });
        });
    }
}

function createGoalElement(text, id, targetTime = null) {
    const li = document.createElement('div');
    li.className = 'goal-item';
    
    const targetTimeDisplay = targetTime ? `<span class="goal-target-time">${targetTime}m</span>` : '';
    
    li.innerHTML = `
        <input type="checkbox" id="goal-${id}" data-goal-text="${text}" data-target-time="${targetTime || ''}">
        <label for="goal-${id}">${text}</label>
        ${targetTimeDisplay}
    `;
    
    // Add event listener to the checkbox
    const checkbox = li.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', updateGoalSessionButton);
    
    return li;
}

function updateGoalSessionButton() {
    const selectedGoals = document.querySelectorAll('#goal-list-container input[type="checkbox"]:checked');
    const startButton = document.getElementById('start-goal-session');
    
    if (selectedGoals.length > 0) {
        startButton.disabled = false;
        startButton.textContent = `Start Focused Session (${selectedGoals.length} goal${selectedGoals.length > 1 ? 's' : ''})`;
    } else {
        startButton.disabled = true;
        startButton.textContent = 'Select at least one goal';
    }
}

function startGoalBasedSession() {
    const selectedGoals = [];
    document.querySelectorAll('#goal-list-container input[type="checkbox"]:checked').forEach(checkbox => {
        const goalData = {
            text: checkbox.dataset.goalText,
            targetTime: checkbox.dataset.targetTime ? parseInt(checkbox.dataset.targetTime) : null
        };
        selectedGoals.push(goalData);
    });

    if (selectedGoals.length === 0) {
        startFocusSession([], function() {
            isFocusModeOn = true;
            userInitiatedStop = false;
            isPaused = false;
            chrome.storage.local.set({ isPaused: false });
            updateUI();
            updateDailyStats();
            updateTimer();
        });
        return;
    }

    console.log("Starting goal-based session with goals:", selectedGoals);
    startFocusSession(selectedGoals, function() {
        isFocusModeOn = true;
        userInitiatedStop = false;
        isPaused = false;
        chrome.storage.local.set({ isPaused: false });
        updateUI();
        updateDailyStats();
        updateTimer();
    });
}

function startFocusSession(goals = [], callback) {
    console.log("Starting focus session with goals:", goals);
    console.log("Goals parameter type:", typeof goals);
    console.log("Goals parameter length:", goals ? goals.length : 'undefined');
    
    document.getElementById('quickStart').disabled = true;
    document.getElementById('goalStart').disabled = true;
    
    const message = {
        toggleFocus: true,
        isFocusModeOn: true,
        goals: goals
    };

    console.log("Sending message to background:", message);

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, function(response) {
            console.log("Start response:", response);
            if (response && response.success) {
                isFocusModeOn = true;
                sessionStartTime = response.startTime;
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
    }).finally(() => {
        document.getElementById('quickStart').disabled = false;
        document.getElementById('goalStart').disabled = false;
    });
}

function stopFocusSession() {
    console.log("Stopping focus session...");
    document.getElementById('stopFocus').disabled = true;
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
    }).finally(() => {
        document.getElementById('stopFocus').disabled = false;
    });
}

function updateUI() {
    const startControls = document.getElementById('start-controls');
    const sessionControls = document.getElementById('session-controls');
    const goalControls = document.getElementById('goal-controls');
    const pauseButton = document.getElementById('pauseResume');
    const statusContainer = document.getElementById('status');
    const statusText = statusContainer.querySelector('.status-text');
    
    if (isFocusModeOn) {
        startControls.style.display = 'none';
        goalControls.style.display = 'none';
        sessionControls.style.display = 'block';

        statusContainer.className = 'status-badge on';
        statusText.textContent = isPaused ? 'PAUSED' : 'ON';
        
        pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
    } else {
        startControls.style.display = 'block';
        sessionControls.style.display = 'none';
        goalControls.style.display = 'none';
        
        statusContainer.className = 'status-badge off';
        statusText.textContent = 'OFF';
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
