document.addEventListener("DOMContentLoaded", () => {
  const startButton = document.getElementById("startTracking")
  const stopButton = document.getElementById("stopTracking")
  const pinButton = document.getElementById("pinTab")
  const taskInput = document.getElementById("taskInput")
  const pinnedTabsList = document.getElementById("pinnedTabsList")
  const resetButton = document.getElementById("resetData")

  // Initialize UI with stored data
  updateUI()
  updatePinnedTabsList()
  updateTrackingButtons()

  function formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes}m`
    }
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  async function updatePinnedTabsList() {
    // Get all tabs
    const tabs = await chrome.tabs.query({})
    // Get pinned tab IDs from storage
    const data = await chrome.storage.local.get(['pinnedTabIds'])
    const pinnedTabIds = new Set(data.pinnedTabIds || [])

    // Clear current list
    pinnedTabsList.innerHTML = ''

    // Add each pinned tab to the list
    tabs.forEach(tab => {
      if (pinnedTabIds.has(tab.id)) {
        const item = document.createElement('div')
        item.className = 'pinned-tab-item'
        
        const title = document.createElement('div')
        title.className = 'pinned-tab-title'
        title.textContent = tab.title

        const unpinButton = document.createElement('button')
        unpinButton.className = 'unpin-button'
        unpinButton.textContent = 'Unpin'
        unpinButton.onclick = () => unpinTab(tab.id)

        item.appendChild(title)
        item.appendChild(unpinButton)
        pinnedTabsList.appendChild(item)
      }
    })
  }

  function unpinTab(tabId) {
    chrome.runtime.sendMessage({ 
      type: "UNPIN_TAB",
      tabId: tabId 
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error unpinning tab:', chrome.runtime.lastError);
        return;
      }
      updatePinnedTabsList();
      updateUI();
    });
  }

  function updateTrackingButtons() {
    chrome.storage.local.get(['tracking'], (data) => {
      const isTracking = data.tracking || false
      startButton.style.display = isTracking ? 'none' : 'inline-block'
      stopButton.style.display = isTracking ? 'inline-block' : 'none'
    })
  }

  startButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "START_TRACKING" })
    updateUI()
    updateTrackingButtons()
  })

  stopButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "STOP_TRACKING" })
    updateUI()
    updateTrackingButtons()
  })

  pinButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "PIN_TAB" }, () => {
      updatePinnedTabsList()
      updateUI()
    })
  })

  resetButton.addEventListener("click", () => {
    if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
      chrome.runtime.sendMessage({ type: "RESET_DATA" }, () => {
        updateUI()
      })
    }
  })

  function updateUI() {
    updateTrackingButtons()
    chrome.runtime.sendMessage({ type: "GET_TIME_DATA" }, (timeData) => {
      if (!timeData) return

      // Update times
      const productiveMinutes = Math.floor(timeData.productive / 60)
      const distractionMinutes = Math.floor(timeData.distraction / 60)
      
      document.getElementById("productiveTime").textContent = formatDuration(productiveMinutes)
      document.getElementById("distractionTime").textContent = formatDuration(distractionMinutes)

      // Update focus rate
      const totalTime = timeData.productive + timeData.distraction
      const focusRate = totalTime ? Math.round((timeData.productive / totalTime) * 100) : 0
      document.getElementById("focusRateBar").style.width = `${focusRate}%`
      document.getElementById("focusRateText").textContent = `${focusRate}%`

      // Update history
      const historyList = document.getElementById("historyList")
      historyList.innerHTML = ""

      timeData.history
        .slice(-10)
        .reverse()
        .forEach((entry) => {
          const item = document.createElement("div")
          item.className = `history-item ${entry.isProductive ? "productive" : "distraction"}`
          item.innerHTML = `
            <span>${entry.title}</span>
            <span>${formatDuration(Math.floor(entry.duration / 60))}</span>
          `
          historyList.appendChild(item)
        })
    })
  }

  // Update UI every second
  setInterval(updateUI, 1000)
})

