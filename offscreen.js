let recorders = {};
let chunks = {};
let streams = {};
let finalization = {};

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "PROCESS_STREAM") {
    const { streamId, tracks, filename } = msg;

    const stream = new MediaStream();
    streams[streamId] = stream;
    chunks[streamId] = [];

    try {
      for (const trackInfo of tracks) {
        const media = await navigator.mediaDevices.getUserMedia(
          trackInfo.constraints
        );
        const track = media.getTracks().find((t) => t.kind === trackInfo.kind);
        if (track) {
          stream.addTrack(track);
        }
      }

      await startRecorder(streamId, stream, filename);
      sendResponse({ ok: true });
    } catch (err) {
      console.error("[offscreen] Failed to get track:", err);
      sendResponse({ ok: false, error: err.message });
    }
  }

  if (msg.type === "STOP_ALL") {
    await stopAll();
    chrome.runtime.sendMessage({ type: "OFFSCREEN_COMPLETE" });
    sendResponse({ ok: true });
  }
});

function startRecorder(id, stream, filename) {
  return new Promise((resolve) => {
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    chunks[id] = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks[id].push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks[id], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      chrome.runtime.sendMessage({
        type: "SAVE_FILE",
        filename,
        blobUrl,
      });

      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });

      resolve(); // signal completion
    };

    // 🧠 Wait for stream to activate before recording
    const preview = document.createElement("video");
    preview.style.display = "none";
    preview.muted = true;
    preview.playsInline = true;
    preview.srcObject = stream;
    document.body.appendChild(preview);

    preview.addEventListener("loadedmetadata", () => {
      preview.play().then(() => {
        setTimeout(() => {
          recorder.start();
          recorders[id] = recorder;

          finalization[id] = {
            promise: new Promise((r) => {
              recorder._resolve = r;
              finalization[id].resolve = r;
            }),
            resolve,
          };
        }, 200);
      });
    });
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
  finalization = {};
}
