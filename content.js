console.log('Content script loaded');

function createDistractionOverlay() {
  console.log('Creating distraction overlay...');
  
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  `;

  // Create popup content
  const popup = document.createElement('div');
  popup.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 12px;
    text-align: center;
    max-width: 400px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  `;

  const title = document.createElement('h2');
  title.textContent = 'Time to Focus!';
  title.style.cssText = `
    color: #dc2626;
    margin: 0 0 16px 0;
    font-size: 24px;
    font-weight: 600;
  `;

  const timeBlocks = document.createElement('div');
  timeBlocks.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 24px;
  `;

  // Get time data
  chrome.runtime.sendMessage({ type: "GET_TIME_DATA" }, (timeData) => {
    if (timeData) {
      const productiveMinutes = Math.floor(timeData.productive / 60);
      const distractionMinutes = Math.floor(timeData.distraction / 60);
      
      timeBlocks.innerHTML = `
        <div style="
          padding: 16px;
          background-color: #f0fdf4;
          border-radius: 8px;
        ">
          <h3 style="
            margin: 0 0 8px 0;
            font-size: 14px;
            color: #333;
          ">Productive Time</h3>
          <span style="
            color: #16a34a;
            font-size: 24px;
            font-weight: bold;
          ">${formatDuration(productiveMinutes)}</span>
        </div>
        <div style="
          padding: 16px;
          background-color: #fef2f2;
          border-radius: 8px;
        ">
          <h3 style="
            margin: 0 0 8px 0;
            font-size: 14px;
            color: #333;
          ">Distraction Time</h3>
          <span style="
            color: #dc2626;
            font-size: 24px;
            font-weight: bold;
          ">${formatDuration(distractionMinutes)}</span>
        </div>
      `;
    }
  });

  const message = document.createElement('p');
  message.innerHTML = "You've been distracted for 1 minute.<br>Time to get back to your main task!";
  message.style.cssText = `
    margin: 0 0 24px 0;
    font-size: 16px;
    line-height: 1.5;
    color: #374151;
  `;

  const button = document.createElement('button');
  button.textContent = 'Got it!';
  button.style.cssText = `
    background-color: #6366f1;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
    transition: background-color 0.2s;
  `;

  button.addEventListener('mouseover', () => {
    button.style.backgroundColor = '#4f46e5';
  });

  button.addEventListener('mouseout', () => {
    button.style.backgroundColor = '#6366f1';
  });

  // Modify the audio playing part in createDistractionOverlay function
  try {
    const audioUrl = chrome.runtime.getURL('alert.mp3');
    console.log('Audio URL:', audioUrl);
    const audio = new Audio(audioUrl);
    audio.volume = 0.3; // Lower volume
    
    // Play sound when overlay is shown
    const playSound = async () => {
      try {
        await audio.play();
        // Loop the sound until user clicks "Got it"
        audio.loop = true;
        console.log('Audio playing successfully');
      } catch (error) {
        console.error('Audio play failed:', error);
      }
    };
    
    playSound();

    // Stop sound when user clicks "Got it"
    button.addEventListener('click', () => {
      audio.pause();
      audio.currentTime = 0;
    });

  } catch (error) {
    console.error('Error setting up audio:', error);
  }

  button.addEventListener('click', () => {
    overlay.remove();
    chrome.runtime.sendMessage({ type: "RETURN_TO_PRODUCTIVE_TAB" });
  });

  popup.appendChild(title);
  popup.appendChild(timeBlocks);
  popup.appendChild(message);
  popup.appendChild(button);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
}

function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  if (request.type === "SHOW_DISTRACTION_ALERT") {
    console.log('Showing distraction overlay...');
    createDistractionOverlay();
  }
}); 