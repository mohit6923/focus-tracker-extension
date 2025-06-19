let lastActiveTab = null;
let lastActivityTime = null;
let currentSessionId = null;

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.toggleFocus) {
        if (request.isFocusModeOn) {
            startFocusSession();
        } else {
            stopFocusSession();
        }
    }
});

function startFocusSession() {
    currentSessionId = generateSessionId();
    lastActivityTime = new Date().getTime();
    
    // Initialize session data
    const sessionData = {
        id: currentSessionId,
        startTime: lastActivityTime,
        endTime: null,
        duration: 0,
        websites: {}
    };
    
    chrome.storage.local.get("sessionHistory", function (data) {
        const history = data.sessionHistory || [];
        history.push(sessionData);
        chrome.storage.local.set({ 
            sessionHistory: history,
            currentSessionId: currentSessionId
        });
    });
    
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs.length > 0) {
            lastActiveTab = tabs[0];
        }
    });
    
    chrome.tabs.onActivated.addListener(handleTabActivation);
    chrome.tabs.onUpdated.addListener(handleTabUpdate);
}

function stopFocusSession() {
    if (currentSessionId) {
        const endTime = new Date().getTime();
        const duration = endTime - lastActivityTime;
        
        chrome.storage.local.get(["sessionHistory", "currentSessionId"], function (data) {
            const history = data.sessionHistory || [];
            const currentSession = history.find(session => session.id === currentSessionId);
            
            if (currentSession) {
                currentSession.endTime = endTime;
                currentSession.duration = duration;
                currentSession.websites = data.focusSessionData || {};
                
                chrome.storage.local.set({ 
                    sessionHistory: history,
                    currentSessionId: null
                });
            }
        });
    }
    
    lastActiveTab = null;
    lastActivityTime = null;
    currentSessionId = null;
    
    chrome.tabs.onActivated.removeListener(handleTabActivation);
    chrome.tabs.onUpdated.removeListener(handleTabUpdate);
}

function handleTabActivation(activeInfo) {
    recordTime();
    chrome.tabs.get(activeInfo.tabId, function (tab) {
        if(tab) {
            lastActiveTab = tab;
        }
    });
}

function handleTabUpdate(tabId, changeInfo, tab) {
    if (tab.active && changeInfo.url) {
        recordTime();
        lastActiveTab = tab;
    }
}

function recordTime() {
    if (lastActiveTab && lastActivityTime && currentSessionId) {
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
