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
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2147483647;
  `;

  // Create popup content
  const popup = document.createElement('div');
  popup.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    text-align: center;
    max-width: 400px;
    font-family: -apple-system, system-ui, sans-serif;
  `;

  const title = document.createElement('h2');
  title.textContent = 'Focus Reminder';
  title.style.cssText = `
    color: #dc3545;
    margin-bottom: 20px;
    font-size: 24px;
  `;

  const message = document.createElement('p');
  message.innerHTML = "You've been distracted for 1 minute.<br>Time to get back to your main task!";
  message.style.cssText = `
    margin-bottom: 20px;
    font-size: 16px;
    line-height: 1.5;
  `;

  const button = document.createElement('button');
  button.textContent = 'Got it!';
  button.style.cssText = `
    background-color: #0d6efd;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    transition: background-color 0.2s;
  `;

  button.addEventListener('mouseover', () => {
    button.style.backgroundColor = '#0b5ed7';
  });

  button.addEventListener('mouseout', () => {
    button.style.backgroundColor = '#0d6efd';
  });

  button.addEventListener('click', () => {
    overlay.remove();
    chrome.runtime.sendMessage({ type: "RETURN_TO_PRODUCTIVE_TAB" });
  });

  popup.appendChild(title);
  popup.appendChild(message);
  popup.appendChild(button);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  if (request.type === "SHOW_DISTRACTION_ALERT") {
    console.log('Showing distraction overlay...');
    createDistractionOverlay();
  }
}); 