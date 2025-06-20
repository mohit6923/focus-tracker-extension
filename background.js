let lastActiveTab = null;
let lastActivityTime = null;
let currentSessionId = null;
let sessionStartTime = null;
let isPaused = false;
let pauseStartTime = null;
let totalPausedTime = 0;

// Add a simple test to verify the background script is loaded
console.log("Background script loaded at:", new Date().toISOString());

// Restore session state on startup
chrome.storage.local.get(["currentSessionId", "isPaused"], function(data) {
    if (data.currentSessionId) {
        console.log("Restoring session state:", data.currentSessionId);
        currentSessionId = data.currentSessionId;
        isPaused = data.isPaused || false;
        
        // Get the session start time from storage
        chrome.storage.local.get("sessionHistory", function(sessionData) {
            const history = sessionData.sessionHistory || [];
            const session = history.find(s => s.id === currentSessionId);
            if (session && session.startTime) {
                sessionStartTime = session.startTime;
                lastActivityTime = Date.now();
                if (isPaused) {
                    pauseStartTime = Date.now();
                }
                console.log("Session restored:", currentSessionId, "started at:", sessionStartTime, "Paused:", isPaused);
            }
        });
    }
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log("Background received message:", request);
    
    if (request.toggleFocus !== undefined) {
        try {
            if (request.toggleFocus && request.isFocusModeOn) {
                console.log("Starting focus session with goals:", request.goals);
                const session = startFocusSession(request.goals);
                sendResponse({success: true, action: "started", startTime: session.startTime});
            } else if (request.toggleFocus && !request.isFocusModeOn) {
                console.log("Stopping focus session...");
                stopFocusSession();
                sendResponse({success: true, action: "stopped"});
            } else {
                sendResponse({success: false, error: "Invalid request"});
            }
        } catch (error) {
            console.error("Error handling message:", error);
            sendResponse({success: false, error: error.message});
        }
    } else if (request.togglePause !== undefined) {
        if (request.isPaused) {
            console.log("Pausing session");
            isPaused = true;
            pauseStartTime = Date.now();
            recordTime(); // Record time up to the pause
        } else {
            console.log("Resuming session");
            isPaused = false;
            if (pauseStartTime) {
                totalPausedTime += Date.now() - pauseStartTime;
            }
            lastActivityTime = Date.now(); // Reset activity time on resume
        }
        chrome.storage.local.set({ isPaused: isPaused });
        sendResponse({success: true});
    } else {
        sendResponse({success: false, error: "Unknown request"});
    }
    
    // Return true to indicate we will send a response asynchronously
    return true;
});

function startFocusSession(goals = []) {
    try {
        // Clear any existing session first
        if (currentSessionId) {
            console.log("Clearing existing session before starting new one");
            stopFocusSession();
        }
        
        currentSessionId = generateSessionId();
        sessionStartTime = new Date().getTime();
        lastActivityTime = sessionStartTime;
        isPaused = false;
        totalPausedTime = 0;
        
        console.log("Creating session:", currentSessionId, "at:", sessionStartTime);
        
        // Initialize session data
        const sessionData = {
            id: currentSessionId,
            startTime: sessionStartTime,
            endTime: null,
            duration: 0,
            websites: {},
            goals: goals
        };
        
        chrome.storage.local.get("sessionHistory", function (data) {
            const history = data.sessionHistory || [];
            history.push(sessionData);
            chrome.storage.local.set({ 
                sessionHistory: history,
                currentSessionId: currentSessionId,
                isPaused: false
            }, function() {
                if (chrome.runtime.lastError) {
                    console.error("Error starting session:", chrome.runtime.lastError);
                } else {
                    console.log("Focus session started:", currentSessionId, "with goals:", sessionData.goals);
                }
            });
        });
        
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs.length > 0) {
                lastActiveTab = tabs[0];
            }
        });
        
        chrome.tabs.onActivated.addListener(handleTabActivation);
        chrome.tabs.onUpdated.addListener(handleTabUpdate);
        
        return sessionData;
        
    } catch (error) {
        console.error("Error in startFocusSession:", error);
    }
}

function stopFocusSession() {
    try {
        console.log("Stopping session. currentSessionId:", currentSessionId, "sessionStartTime:", sessionStartTime);
        
        // If we don't have a currentSessionId, try to get it from storage
        if (!currentSessionId) {
            chrome.storage.local.get("currentSessionId", function(data) {
                if (data.currentSessionId) {
                    console.log("Found session ID in storage:", data.currentSessionId);
                    currentSessionId = data.currentSessionId;
                    // Now try to stop it
                    stopFocusSessionInternal();
                } else {
                    console.log("No session ID found in storage, clearing anyway");
                    clearSessionState();
                }
            });
        } else {
            stopFocusSessionInternal();
        }
        
    } catch (error) {
        console.error("Error in stopFocusSession:", error);
        clearSessionState();
    }
}

function stopFocusSessionInternal() {
    if (currentSessionId && sessionStartTime) {
        const endTime = new Date().getTime();
        const duration = (endTime - sessionStartTime) - totalPausedTime;
        
        console.log("Session duration:", duration, "ms");
        
        chrome.storage.local.get(["sessionHistory", "focusSessionData"], function (data) {
            const history = data.sessionHistory || [];
            const currentSession = history.find(session => session.id === currentSessionId);
            
            if (currentSession) {
                currentSession.endTime = endTime;
                currentSession.duration = duration > 0 ? duration : 0;
                currentSession.websites = data.focusSessionData || {};
                // Preserve the goals data - don't overwrite it
                // currentSession.goals should already exist from when the session was created
                
                chrome.storage.local.set({ 
                    sessionHistory: history,
                    currentSessionId: null,
                    focusSessionData: {},
                    isPaused: false
                }, function() {
                    if (chrome.runtime.lastError) {
                        console.error("Error stopping session:", chrome.runtime.lastError);
                    } else {
                        console.log("Focus session stopped:", currentSessionId, "Duration:", duration, "Goals:", currentSession.goals);
                    }
                    clearSessionState();
                });
            } else {
                console.error("Could not find session to stop:", currentSessionId);
                // Force clear the session anyway
                chrome.storage.local.set({
                    currentSessionId: null,
                    focusSessionData: {},
                    isPaused: false
                }, function() {
                    clearSessionState();
                });
            }
        });
    } else {
        console.log("No active session to stop, clearing anyway");
        // Force clear even if no session
        chrome.storage.local.set({
            currentSessionId: null,
            focusSessionData: {},
            isPaused: false
        }, function() {
            clearSessionState();
        });
    }
}

function clearSessionState() {
    // Always clean up
    lastActiveTab = null;
    lastActivityTime = null;
    currentSessionId = null;
    sessionStartTime = null;
    isPaused = false;
    pauseStartTime = null;
    totalPausedTime = 0;
    
    chrome.tabs.onActivated.removeListener(handleTabActivation);
    chrome.tabs.onUpdated.removeListener(handleTabUpdate);
    
    console.log("Session state cleared");
}

function handleTabActivation(activeInfo) {
    recordTime();
    chrome.tabs.get(activeInfo.tabId, function (tab) {
        if(tab && tab.status === 'complete') {
            lastActiveTab = tab;
        }
    });
}

function handleTabUpdate(tabId, changeInfo, tab) {
    if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) {
        recordTime();
        lastActiveTab = tab;
    }
}

function recordTime() {
    if (lastActiveTab && lastActivityTime && currentSessionId && !isPaused) {
        const now = new Date().getTime();
        const timeSpent = now - lastActivityTime;
        
        if (lastActiveTab.url && lastActiveTab.url.startsWith("http")) {
            const url = new URL(lastActiveTab.url);
            const hostname = url.hostname;
            
            chrome.storage.local.get("focusSessionData", function (data) {
                let sessionData = data.focusSessionData || {};
                if (sessionData[hostname]) {
                    sessionData[hostname] += timeSpent;
                } else {
                    sessionData[hostname] = timeSpent;
                }
                chrome.storage.local.set({ focusSessionData: sessionData });
            });
        }
    }
    lastActivityTime = new Date().getTime();
}

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
