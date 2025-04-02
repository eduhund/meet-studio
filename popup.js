import { checkPermissions } from "./permissions.js";
import { createSourceBlock } from "./ui/deviceSelector.js";
import { createVolumeIndicator } from "./ui/volumeIndicator.js";
import { createVideoPreview } from "./ui/videoPreview.js";

let micStream, camStream;
let isRecording = false;

const state = {
  micEnabled: true,
  camEnabled: true,
  micDeviceId: null,
  camDeviceId: null,
};

const loader = document.getElementById("loader");
const content = document.getElementById("content");
const recordButton = document.getElementById("record-button");
const permissionStatus = document.getElementById("permission-status");

async function init() {
  const ok = await checkPermissions();
  permissionStatus.textContent = ok
    ? "Ready to record"
    : "Please grant permissions";
  recordButton.disabled = !ok;
  if (!ok) return;

  const devices = await navigator.mediaDevices.enumerateDevices();
  await renderSources(devices);

  loader.classList.add("hidden");
  content.classList.remove("hidden");
}

async function renderSources(devices) {
  const micDevices = devices.filter((d) => d.kind === "audioinput");
  const camDevices = devices.filter((d) => d.kind === "videoinput");

  const micBlock = document.getElementById("microphone-settings");
  createSourceBlock(
    "Microphone",
    micDevices,
    true,
    micBlock,
    async (enabled, deviceId) => {
      state.micEnabled = enabled;
      state.micDeviceId = deviceId;
      micBlock.querySelector(".volume-bar")?.remove();
      if (enabled) {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId },
        });
        createVolumeIndicator(micBlock, {
          getLevel: () => {
            const ctx = new AudioContext();
            const src = ctx.createMediaStreamSource(micStream);
            const analyser = ctx.createAnalyser();
            src.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(data);
            ctx.close();
            return Math.max(...data) / 255;
          },
        });
      } else {
        micStream?.getTracks().forEach((t) => t.stop());
      }
    }
  );

  const camBlock = document.getElementById("camera-settings");
  createSourceBlock(
    "Camera",
    camDevices,
    true,
    camBlock,
    async (enabled, deviceId) => {
      state.camEnabled = enabled;
      state.camDeviceId = deviceId;
      camBlock.querySelector("video")?.remove();
      if (enabled) {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        createVideoPreview(camBlock, camStream);
      } else {
        camStream?.getTracks().forEach((t) => t.stop());
      }
    }
  );
}

recordButton.onclick = async () => {
  if (!isRecording) {
    const now = new Date().toISOString().replace(/[:.]/g, "-");
    const configs = [];

    if (state.micEnabled && state.micDeviceId) {
      configs.push({
        streamId: "mic",
        filename: `${now}-mic.webm`,
        tracks: [
          {
            kind: "audio",
            constraints: {
              audio: { deviceId: state.micDeviceId },
            },
          },
        ],
      });
    }

    if (state.camEnabled && state.camDeviceId) {
      configs.push({
        streamId: "cam",
        filename: `${now}-camera.webm`,
        tracks: [
          {
            kind: "video",
            constraints: {
              video: { deviceId: state.camDeviceId },
            },
          },
        ],
      });
    }

    const res = await chrome.runtime.sendMessage({
      type: "START_RECORDING",
      payload: configs,
    });

    if (res && res.ok) {
      isRecording = true;
      recordButton.classList.add("recording");
      recordButton.textContent = "Stop Recording";
      window.close();
    }
  } else {
    const res = await chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
    if (res && res.ok) {
      isRecording = false;
      recordButton.classList.remove("recording");
      recordButton.textContent = "Start Recording";
    }
  }
};

init();
