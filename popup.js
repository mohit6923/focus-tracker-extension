let isFocusModeOn = false;
let sessionStartTime = null;

document.addEventListener("DOMContentLoaded", function () {
    const startButton = document.getElementById("startButton");
    const analyticsLink = document.getElementById("analyticsLink");
    
    // Check current session status
    chrome.storage.local.get("currentSessionId", function (data) {
        if (data.currentSessionId) {
            isFocusModeOn = true;
            sessionStartTime = Date.now();
            updateButtonState();
            startSessionTimer();
        }
    });
    
    startButton.addEventListener("click", function () {
        isFocusModeOn = !isFocusModeOn;
        
        if (isFocusModeOn) {
            sessionStartTime = Date.now();
            startSessionTimer();
        } else {
            stopSessionTimer();
        }
        
        updateButtonState();
        
        // Send message to background script
        chrome.runtime.sendMessage({
            toggleFocus: true,
            isFocusModeOn: isFocusModeOn
        });
    });
    
    analyticsLink.addEventListener("click", function () {
        chrome.tabs.create({ url: "analytics.html" });
    });
});

function updateButtonState() {
    const startButton = document.getElementById("startButton");
    const statusText = document.getElementById("statusText");
    
    if (isFocusModeOn) {
        startButton.textContent = "Stop Focus";
        startButton.style.backgroundColor = "#f44336";
        statusText.textContent = "Focus session active";
        statusText.style.color = "#4CAF50";
    } else {
        startButton.textContent = "Start Focus";
        startButton.style.backgroundColor = "#4CAF50";
        statusText.textContent = "No active session";
        statusText.style.color = "#666";
        document.getElementById("sessionTimer").textContent = "";
    }
}

function startSessionTimer() {
    if (sessionStartTime) {
        updateTimer();
        setInterval(updateTimer, 1000);
    }
}

function stopSessionTimer() {
    sessionStartTime = null;
    document.getElementById("sessionTimer").textContent = "";
}

function updateTimer() {
    if (sessionStartTime) {
        const elapsed = Date.now() - sessionStartTime;
        const minutes = Math.floor(elapsed / (1000 * 60));
        const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
        document.getElementById("sessionTimer").textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}
