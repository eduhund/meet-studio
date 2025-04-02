let isRecording = false;

chrome.runtime.onInstalled.addListener(() => {});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SET_RECORDING_STATE") {
    isRecording = message.value;
    updateIcon(isRecording);
  }
  sendResponse();
});

function updateIcon(recording) {
  const path = recording ? "assets/icon-recording.png" : "assets/logo.png";
  chrome.action.setIcon({ path });
}
