import { checkPermissions } from "./permissions.js";
import { AudioRecorder } from "./recorder/audioRecorder.js";
import { VideoRecorder } from "./recorder/videoRecorder.js";
import { ScreenRecorder } from "./recorder/screenRecorder.js";
import { createSourceBlock } from "./ui/deviceSelector.js";
import { createVolumeIndicator } from "./ui/volumeIndicator.js";
import { createVideoPreview } from "./ui/videoPreview.js";
import { createGroupSettings } from "./ui/groupSettings.js";

let micRecorder, camRecorder, screenRecorder;
let micStream, camStream, screenStream;

let isRecording = false;

const state = {
  micEnabled: true,
  camEnabled: true,
  screenEnabled: false,
  systemAudioEnabled: false,
  micDeviceId: null,
  camDeviceId: null,
  micCamSeparate: false,
  screenAudioSeparate: false,
};

const app = document.getElementById("app");
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
      micBlock.querySelector("video")?.remove();
      micBlock.querySelector(".volume-bar")?.remove();
      if (enabled) {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId },
        });
        micRecorder = new AudioRecorder(micStream, "mic");
        createVolumeIndicator(micBlock, micRecorder); // !!должен работать до, во время и после записи!!
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
          video: { deviceId, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        camRecorder = new VideoRecorder(camStream, "camera");
        createVideoPreview(camBlock, camStream); // !!соответствие пропорциям и вьюпорту!!
      } else {
        camStream?.getTracks().forEach((t) => t.stop());
      }
    }
  );

  const screenBlock = document.getElementById("screen-settings");
  createSourceBlock("Screen", [], false, screenBlock, async (enabled) => {
    state.screenEnabled = enabled;
    screenBlock.querySelector("video")?.remove();
    if (enabled) {
      screenRecorder = new ScreenRecorder();
      screenStream = await screenRecorder.selectScreenSource();
      createVideoPreview(screenBlock, screenStream);
    } else {
      screenStream?.getTracks().forEach((t) => t.stop());
    }
  });

  createSourceBlock(
    "System Audio",
    [],
    false,
    document.getElementById("system-audio-settings"),
    (enabled) => {
      state.systemAudioEnabled = enabled;
    }
  );

  createGroupSettings(
    "mic-cam-group",
    "Record microphone and camera separately",
    (val) => {
      state.micCamSeparate = val;
    },
    () => state.micEnabled && state.camEnabled
  );

  createGroupSettings(
    "screen-audio-group",
    "Record screen and system audio separately",
    (val) => {
      state.screenAudioSeparate = val;
    },
    () => state.screenEnabled && state.systemAudioEnabled
  );
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function updateRecordingIcon(isOn) {
  chrome.runtime.sendMessage({ type: "SET_RECORDING_STATE", value: isOn });
}

recordButton.onclick = () => {
  if (!isRecording) {
    isRecording = true;
    updateRecordingIcon(true);
    recordButton.classList.add("recording");
    recordButton.textContent = "Stop Recording";
    const now = new Date().toISOString().replace(/[:.]/g, "-");

    if (state.micEnabled && (!state.camEnabled || state.micCamSeparate)) {
      micRecorder.start((b) => saveBlob(b, `${now}-mic.webm`));
    }

    if (state.camEnabled && (!state.micEnabled || state.micCamSeparate)) {
      camRecorder.start((b) => saveBlob(b, `${now}-camera.webm`));
    }

    if (state.micEnabled && state.camEnabled && !state.micCamSeparate) {
      const combinedStream = new MediaStream([
        ...camStream.getVideoTracks(),
        ...micStream.getAudioTracks(),
      ]);
      const recorder = new VideoRecorder(combinedStream, "mic-camera");
      recorder.start((b) => saveBlob(b, `${now}-mic-camera.webm`));
    }

    if (
      state.screenEnabled &&
      state.systemAudioEnabled &&
      !state.screenAudioSeparate
    ) {
      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...screenStream.getAudioTracks(),
      ]);
      const recorder = new VideoRecorder(combinedStream, "screen-audio");
      recorder.start((b) => saveBlob(b, `${now}-screen-audio.webm`));
    }

    if (
      state.screenEnabled &&
      (!state.systemAudioEnabled || state.screenAudioSeparate)
    ) {
      screenRecorder.start((b) => saveBlob(b, `${now}-screen.webm`));
    }
  } else {
    isRecording = false;
    updateRecordingIcon(false);
    recordButton.classList.remove("recording");
    recordButton.textContent = "Start Recording";

    micRecorder?.stop();
    camRecorder?.stop();
    screenRecorder?.stop();
  }
};

init();
