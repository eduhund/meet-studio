let recorders = {};
let chunks = {};
let streams = {};
let pending = {};
let finalization = {};

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "PROCESS_STREAM") {
    const { streamId, tracks, filename } = msg;

    const stream = new MediaStream();
    streams[streamId] = stream;
    chunks[streamId] = [];
    pending[streamId] = { expected: tracks.length, received: 0, filename };

    for (const trackInfo of tracks) {
      const media = await navigator.mediaDevices.getUserMedia(
        trackInfo.constraints
      );
      const track = media.getTracks().find((t) => t.kind === trackInfo.kind);
      if (track) {
        stream.addTrack(track);
        pending[streamId].received += 1;
      }
    }

    if (pending[streamId].received === pending[streamId].expected) {
      await startRecorder(streamId, stream, filename);
    }

    sendResponse({ ok: true });
  }

  if (msg.type === "STOP_ALL") {
    await stopAll();
    chrome.runtime.sendMessage({ type: "OFFSCREEN_COMPLETE" });
    sendResponse({ ok: true });
  }
});

function startRecorder(id, stream, filename) {
  return new Promise((resolve) => {
    const recorder = new MediaRecorder(stream);
    chunks[id] = [];

    recorder.ondataavailable = (e) => chunks[id].push(e.data);

    recorder.onstop = () => {
      const blob = new Blob(chunks[id], { type: recorder.mimeType });
      const reader = new FileReader();

      reader.onloadend = () => {
        chrome.runtime.sendMessage({
          type: "SAVE_FILE",
          filename,
          blobUrl: reader.result,
        });
        resolve();
      };

      reader.readAsDataURL(blob);

      // 🔌 Освобождаем устройство
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) {}
      });
    };

    recorder.start();
    recorders[id] = recorder;
    finalization[id] = {
      promise: new Promise((r) => (recorder._resolve = r)),
      resolve,
    };
  });
}

async function stopAll() {
  const stopping = [];

  for (const id in recorders) {
    if (finalization[id]) {
      stopping.push(finalization[id].promise);
    }
    recorders[id].stop();
  }

  await Promise.all(stopping);

  recorders = {};
  chunks = {};
  streams = {};
  pending = {};
  finalization = {};
}
