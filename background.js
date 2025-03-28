// This is needed for screen capture in Manifest v3
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getScreenStream") {
    chrome.desktopCapture.chooseDesktopMedia(
      ["screen", "window", "tab"],
      sender.tab,
      (streamId) => {
        if (streamId) {
          sendResponse({ streamId });
        } else {
          sendResponse({ error: "Permission denied" });
        }
      }
    );
    return true; // Required to use sendResponse asynchronously
  }
});
