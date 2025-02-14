let tracking = false
const pinnedTabs = new Set()
let startTime = null
let currentTab = null
const timeData = {
  productive: 0,
  distraction: 0,
  history: [],
}

let distractionTimer = null
let lastActiveTabId = null
let lastProductiveTabId = null

// Add this function to initialize state from storage
async function initializeState() {
  const data = await chrome.storage.local.get(['tracking', 'timeData', 'pinnedTabIds']);
  tracking = data.tracking || false;
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
  if (!tracking) return

  const tab = await chrome.tabs.get(activeInfo.tabId)
  handleTabChange(tab)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tracking || !changeInfo.url) return

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
      tracking = true
      startTime = Date.now()
      
      // Store tracking state
      chrome.storage.local.set({ tracking: true });
      
      // Test notification when tracking starts
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icons/icon48.png',
        title: 'Tracking Started',
        message: 'Focus tracking is now active',
        requireInteraction: false
      }, (notificationId) => {
        console.log('Start tracking notification created with ID:', notificationId);
        if (chrome.runtime.lastError) {
          console.error('Start notification error:', chrome.runtime.lastError);
        }
      });
      break

    case "STOP_TRACKING":
      tracking = false
      clearDistractionTimer()
      // Store tracking state
      chrome.storage.local.set({ tracking: false });
      break

    case "PIN_TAB":
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          pinnedTabs.add(tabs[0].id)
          // Store pinned tab IDs
          chrome.storage.local.set({ 
            pinnedTabIds: Array.from(pinnedTabs) 
          });
        }
      })
      break

    case "PIN_MULTIPLE_TABS":
      chrome.tabs.query({ highlighted: true, currentWindow: true }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.update(tab.id, { pinned: true });
          pinnedTabs.add(tab.id);
        });
        // Store pinned tab IDs
        chrome.storage.local.set({ 
          pinnedTabIds: Array.from(pinnedTabs) 
        });
      });
      break

    case "GET_TIME_DATA":
      sendResponse(timeData)
      break

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

