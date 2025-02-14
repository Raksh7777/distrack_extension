let tracking = false
let isPaused = false
const pinnedTabs = new Set()
let startTime = null
let currentTab = null
let lastActiveTabId = null
let lastProductiveTabId = null
let distractionTimer = null

const timeData = {
  productive: 0,
  distraction: 0,
  history: [],
}

// Initialize state from storage
async function initializeState() {
  const data = await chrome.storage.local.get(['tracking', 'isPaused', 'timeData', 'pinnedTabIds']);
  tracking = data.tracking || false;
  isPaused = data.isPaused || false;
  if (data.timeData) {
    timeData.productive = data.timeData.productive;
    timeData.distraction = data.timeData.distraction;
    timeData.history = data.timeData.history;
  }
  if (data.pinnedTabIds) {
    data.pinnedTabIds.forEach(id => pinnedTabs.add(id));
  }
}

// Call initializeState when the extension loads
initializeState();

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!tracking || isPaused) return

  const tab = await chrome.tabs.get(activeInfo.tabId)
  handleTabChange(tab)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tracking || isPaused || !changeInfo.url) return

  handleTabChange(tab)
})

function handleTabChange(tab) {
  console.log('Tab changed:', tab);
  const now = Date.now()

  // Don't process if it's the same tab
  if (currentTab && currentTab.id === tab.id) {
    console.log('Same tab, skipping processing');
    return;
  }

  lastActiveTabId = tab.id
  
  if (isPinnedTab(tab)) {
    lastProductiveTabId = tab.id
  }
  
  if (currentTab) {
    const duration = now - startTime
    updateTimeData(currentTab, duration)
  }

  currentTab = tab
  startTime = now

  if (!isPinnedTab(tab)) {
    console.log('Starting distraction timer for unpinned tab');
    startDistractionTimer()
  } else {
    console.log('Clearing distraction timer for pinned tab');
    clearDistractionTimer()
  }
}

function isPinnedTab(tab) {
  return pinnedTabs.has(tab.id)
}

function updateTimeData(tab, duration) {
  const isProductive = isPinnedTab(tab)
  const durationInSeconds = Math.floor(duration / 1000)

  if (isProductive) {
    timeData.productive += durationInSeconds
  } else {
    timeData.distraction += durationInSeconds
  }

  timeData.history.push({
    title: tab.title,
    url: tab.url,
    duration: durationInSeconds,
    timestamp: new Date().toISOString(),
    isProductive,
  })

  chrome.storage.local.set({ timeData })
}

async function checkNotificationPermission() {
  const permission = await chrome.notifications.getPermissionLevel();
  console.log('Notification permission level:', permission);
  
  if (permission !== 'granted') {
    console.log('Notifications not granted');
  }
}

function showDistractionAlert() {
  console.log('Showing distraction alert...');
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs[0]) {
      try {
        console.log('Sending alert message to tab:', tabs[0].id);
        await chrome.tabs.sendMessage(tabs[0].id, { 
          type: "SHOW_DISTRACTION_ALERT" 
        });
        console.log('Alert message sent successfully');
      } catch (error) {
        console.error('Error sending alert message:', error);
        // Try reinjecting content script if it failed
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content.js']
        });
        // Try sending message again
        await chrome.tabs.sendMessage(tabs[0].id, { 
          type: "SHOW_DISTRACTION_ALERT" 
        });
      }
    }
  });
}

function startDistractionTimer() {
  console.log('Starting distraction timer...');
  clearDistractionTimer()

  const DISTRACTION_CHECK_INTERVAL = 1000
  const DISTRACTION_THRESHOLD = 1 * 60
  let distractionSeconds = 0

  distractionTimer = setInterval(() => {
    distractionSeconds++
    
    if (distractionSeconds % 10 === 0) {  // Log every 10 seconds
      console.log(`Distraction timer: ${distractionSeconds}/${DISTRACTION_THRESHOLD} seconds`);
    }

    if (distractionSeconds >= DISTRACTION_THRESHOLD) {
      console.log('Distraction threshold reached!');
      showDistractionAlert()
      distractionSeconds = 0
      console.log('Distraction timer reset');
    }
  }, DISTRACTION_CHECK_INTERVAL)
}

function clearDistractionTimer() {
  if (distractionTimer) {
    console.log('Clearing distraction timer');
    clearInterval(distractionTimer)
    distractionTimer = null
  }
}

// Add notification button click listener
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === 'distraction-alert') {
    chrome.notifications.clear(notificationId)
  }
})

// Modify the message listener to persist state
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request.type);
  switch (request.type) {
    case "START_TRACKING":
      console.log('Starting tracking...');
      tracking = true;
      isPaused = false;
      startTime = Date.now();
      chrome.storage.local.set({ 
        tracking: true,
        isPaused: false 
      });
      
      // Get current tab and start tracking
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]) {
          handleTabChange(tabs[0]);
        }
      });
      break;

    case "PAUSE_TRACKING":
      isPaused = true;
      clearDistractionTimer();
      if (currentTab) {
        const duration = Date.now() - startTime;
        updateTimeData(currentTab, duration);
      }
      chrome.storage.local.set({ isPaused: true });
      break;

    case "STOP_TRACKING":
      tracking = false;
      isPaused = false;
      clearDistractionTimer();
      if (currentTab) {
        const duration = Date.now() - startTime;
        updateTimeData(currentTab, duration);
      }
      currentTab = null;
      startTime = null;
      chrome.storage.local.set({ 
        tracking: false,
        isPaused: false 
      });
      break;

    case "PIN_TAB":
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          pinnedTabs.add(tabs[0].id);
          chrome.storage.local.set({ 
            pinnedTabIds: Array.from(pinnedTabs) 
          });
          if (tracking && !isPaused) {
            handleTabChange(tabs[0]);
          }
        }
      });
      break;

    case "UNPIN_TAB":
      if (request.tabId) {
        pinnedTabs.delete(request.tabId);
        chrome.storage.local.set({ 
          pinnedTabIds: Array.from(pinnedTabs) 
        }, () => {
          if (tracking && !isPaused) {
            chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
              if (activeTabs[0]) {
                handleTabChange(activeTabs[0]);
              }
            });
          }
          sendResponse(); // Send response back to popup
        });
      }
      return true; // Indicate we'll send response asynchronously

    case "PIN_MULTIPLE_TABS":
      chrome.tabs.query({ highlighted: true, currentWindow: true }, (tabs) => {
        tabs.forEach(tab => {
          pinnedTabs.add(tab.id);
        });
        chrome.storage.local.set({ 
          pinnedTabIds: Array.from(pinnedTabs) 
        });
        if (tracking && !isPaused) {
          chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
            if (activeTabs[0]) {
              handleTabChange(activeTabs[0]);
            }
          });
        }
      });
      break;

    case "RESET_DATA":
      timeData.productive = 0;
      timeData.distraction = 0;
      timeData.history = [];
      chrome.storage.local.set({ timeData });
      break;

    case "GET_TIME_DATA":
      sendResponse(timeData);
      break;

    case "RETURN_TO_PRODUCTIVE_TAB":
      if (lastProductiveTabId) {
        chrome.tabs.get(lastProductiveTabId, (tab) => {
          if (!chrome.runtime.lastError && tab) {
            chrome.tabs.update(lastProductiveTabId, { active: true });
          } else {
            chrome.tabs.query({ pinned: true }, (tabs) => {
              if (tabs.length > 0) {
                chrome.tabs.update(tabs[0].id, { active: true });
              } else {
                if (lastActiveTabId) {
                  chrome.tabs.update(lastActiveTabId, { active: true });
                }
              }
            });
          }
        });
      } else {
        if (lastActiveTabId) {
          chrome.tabs.update(lastActiveTabId, { active: true });
        }
      }
      break
  }
})

// Add this listener to clean up closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  if (pinnedTabs.has(tabId)) {
    pinnedTabs.delete(tabId);
    chrome.storage.local.set({ 
      pinnedTabIds: Array.from(pinnedTabs) 
    });
  }
});

