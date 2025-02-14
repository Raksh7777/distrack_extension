document.addEventListener("DOMContentLoaded", () => {
  const startButton = document.getElementById("startTracking")
  const pinButton = document.getElementById("pinTab")
  const taskInput = document.getElementById("taskInput")
  const alertEl = document.getElementById("distractionAlert")
  const alertMessage = document.getElementById("alertMessage")
  const gotItButton = document.getElementById("gotItButton")
  const progressEl = document.getElementById("distractionProgress")
  const progressFill = document.getElementById("progressFill")
  const progressText = document.getElementById("progressText")

  let isTracking = false

  // Initialize UI with stored data
  updateUI()

  startButton.addEventListener("click", () => {
    if (!isTracking) {
      chrome.runtime.sendMessage({ type: "START_TRACKING" })
      startButton.textContent = "Stop Tracking"
      isTracking = true
    } else {
      chrome.runtime.sendMessage({ type: "STOP_TRACKING" })
      startButton.textContent = "Start Tracking"
      isTracking = false
      clearDistractionAlert()
    }
  })

  pinButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "PIN_TAB" })
    showToast("Current tab pinned as productive")
  })

  gotItButton.addEventListener("click", clearDistractionAlert)

  // Listen for distraction messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case "SHOW_DISTRACTION_ALERT":
        showDistractionAlert(message.message)
        break
      case "DISTRACTION_UPDATE":
        updateDistractionProgress(message.seconds, message.threshold)
        break
      case "CLEAR_DISTRACTION":
        clearDistractionAlert()
        break
    }
  })

  // Update UI every second
  setInterval(updateUI, 1000)
})

function updateUI() {
  chrome.runtime.sendMessage({ type: "GET_TIME_DATA" }, (timeData) => {
    if (!timeData) return

    // Update times
    document.getElementById("productiveTime").textContent = formatTime(timeData.productive)
    document.getElementById("distractionTime").textContent = formatTime(timeData.distraction)

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
        <span>${formatTime(entry.duration)}</span>
      `
        historyList.appendChild(item)
      })
  })
}

function formatTime(seconds) {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m`
}

function showToast(message) {
  const toast = document.createElement("div")
  toast.className = "toast"
  toast.textContent = message
  document.body.appendChild(toast)

  setTimeout(() => {
    toast.remove()
  }, 3000)
}

function showDistractionAlert(message) {
  const alertEl = document.getElementById("distractionAlert")
  const alertMessage = document.getElementById("alertMessage")
  alertMessage.textContent = message
  alertEl.classList.remove("hidden")
}

function updateDistractionProgress(seconds, threshold) {
  const progressEl = document.getElementById("distractionProgress")
  const progressFill = document.getElementById("progressFill")
  const progressText = document.getElementById("progressText")
  const percentage = (seconds / threshold) * 100

  progressFill.style.width = `${percentage}%`
  progressText.textContent = `Distracted: ${formatTime(seconds)}`
  progressEl.classList.remove("hidden")
}

function clearDistractionAlert() {
  document.getElementById("distractionAlert").classList.add("hidden")
  document.getElementById("distractionProgress").classList.add("hidden")
}

