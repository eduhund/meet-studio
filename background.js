let isRecording = false;
let streamConfigs = [];

chrome.runtime.onInstalled.addListener(() => {});

chrome.action.onClicked.addListener(async (tab) => {
  if (isRecording) {
    await stopOffscreenRecording();
    isRecording = false;
    updateIcon(false);
  } else {
    chrome.action.setPopup({ popup: "popup.html" });
    chrome.action.openPopup();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === "START_RECORDING") {
      if (isRecording) return sendResponse({ ok: false });

      await ensureOffscreenDocument();
      isRecording = true;
      streamConfigs = msg.payload;
      await startStreamsInOffscreen(streamConfigs);
      updateIcon(true);
      sendResponse({ ok: true });
    } else if (msg.type === "STOP_RECORDING") {
      if (!isRecording) return sendResponse({ ok: false });

      await stopOffscreenRecording();
      isRecording = false;
      updateIcon(false);
      sendResponse({ ok: true });
    } else if (msg.type === "GET_RECORDING_STATE") {
      sendResponse({ isRecording });
    } else if (msg.type === "SAVE_FILE") {
      const { filename, blobUrl } = msg;
      chrome.downloads.download({
        url: blobUrl,
        filename,
        saveAs: false,
      });
    } else if (msg.type === "OFFSCREEN_COMPLETE") {
      // 🔁 Ждём немного, чтобы гарантировать завершение сохранения
      setTimeout(() => chrome.offscreen.closeDocument(), 1000);
    }
  })();
  return true;
});

chrome.action.onClicked.addListener(async () => {
  if (isRecording) {
    await stopOffscreenRecording();
    isRecording = false;
    updateIcon(false);
  } else {
    chrome.action.setPopup({ popup: "popup.html" });
  }
});

function updateIcon(recording) {
  const path = recording ? "assets/icon-recording.png" : "assets/logo.png";
  chrome.action.setIcon({ path });
  chrome.action.setPopup({ popup: recording ? "" : "popup.html" });
}

async function ensureOffscreenDocument() {
  const exists = await chrome.offscreen.hasDocument();
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["BLOBS"],
      justification: "Need to record and process MediaStream in background.",
    });
  }
}

async function startStreamsInOffscreen(configs) {
  for (const config of configs) {
    await chrome.runtime.sendMessage({
      type: "PROCESS_STREAM",
      streamId: config.streamId,
      tracks: config.tracks,
      filename: config.filename,
    });
  }
}

async function stopOffscreenRecording() {
  await chrome.runtime.sendMessage({ type: "STOP_ALL" });
}
