document.addEventListener("DOMContentLoaded", () => {
  // UI Elements
  const audioCheckbox = document.getElementById("audioCheckbox");
  const videoCheckbox = document.getElementById("videoCheckbox");
  const screenCheckbox = document.getElementById("screenCheckbox");
  const recordBtn = document.getElementById("recordBtn");
  const statusText = document.getElementById("statusText");
  const cameraPreview = document.getElementById("cameraPreview");
  const screenPreview = document.getElementById("screenPreview");
  const audioMeter = document.getElementById("audioMeter");
  const devicesSelect = document.getElementById("devicesSelect");
  const qualitySelect = document.getElementById("qualitySelect");

  // State variables
  let mediaRecorders = [];
  let mediaStreams = [];
  let audioContext;
  let analyser;
  let microphone;
  let isRecording = false;
  let devices = [];

  // Quality presets
  const qualityPresets = {
    low: {
      video: { width: 640, height: 480 },
      audio: { sampleRate: 44100, bitrate: 64000 },
    },
    medium: {
      video: { width: 1280, height: 720 },
      audio: { sampleRate: 48000, bitrate: 128000 },
    },
    high: {
      video: { width: 1920, height: 1080 },
      audio: { sampleRate: 48000, bitrate: 192000 },
    },
  };

  // Initialize
  initDevices();
  updateUI();

  // Main functions
  async function initDevices() {
    try {
      devices = await navigator.mediaDevices.enumerateDevices();
      updateDeviceSelects();
      startPreviews();
    } catch (error) {
      console.error("Device enumeration error:", error);
    }
  }

  function updateDeviceSelects() {
    const videoDevices = devices.filter((d) => d.kind === "videoinput");
    const audioDevices = devices.filter((d) => d.kind === "audioinput");

    // Update camera select
    const cameraSelect = document.getElementById("cameraSelect");
    cameraSelect.innerHTML = "";
    videoDevices.forEach((device) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.text = device.label || `Camera ${cameraSelect.length + 1}`;
      cameraSelect.appendChild(option);
    });

    // Update microphone select
    const micSelect = document.getElementById("micSelect");
    micSelect.innerHTML = "";
    audioDevices.forEach((device) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.text = device.label || `Microphone ${micSelect.length + 1}`;
      micSelect.appendChild(option);
    });
  }

  async function startPreviews() {
    try {
      // Start camera preview if enabled
      if (videoCheckbox.checked) {
        const cameraId = document.getElementById("cameraSelect").value;
        const constraints = {
          video: {
            deviceId: cameraId ? { exact: cameraId } : undefined,
            ...qualityPresets[qualitySelect.value].video,
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraPreview.srcObject = stream;
        cameraPreview.style.objectFit = "contain"; // Fix scaling
        mediaStreams.push(stream);
      }

      // Start audio meter
      if (audioCheckbox.checked) {
        await setupAudioMeter();
      }
    } catch (error) {
      console.error("Preview error:", error);
    }
  }

  async function setupAudioMeter() {
    try {
      const micId = document.getElementById("micSelect").value;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: micId ? { exact: micId } : undefined,
          ...qualityPresets[qualitySelect.value].audio,
        },
      });

      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 32;

      mediaStreams.push(stream);
      updateAudioMeter();
    } catch (error) {
      console.error("Audio meter error:", error);
    }
  }

  function updateAudioMeter() {
    if (!analyser) return;

    const array = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    const avg = array.reduce((a, b) => a + b) / array.length;
    audioMeter.style.width = `${avg}%`;

    requestAnimationFrame(updateAudioMeter);
  }

  async function toggleRecording() {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
    updateButtonStyle();
  }

  function updateButtonStyle() {
    if (isRecording) {
      recordBtn.classList.add("recording");
      recordBtn.classList.remove("not-recording");
    } else {
      recordBtn.classList.add("not-recording");
      recordBtn.classList.remove("recording");
    }
  }

  async function startRecording() {
    try {
      isRecording = true;
      recordBtn.textContent = "Stop Recording";
      statusText.textContent = "Starting recording...";

      // Clear previous recordings
      mediaRecorders = [];

      // Get selected devices
      const cameraId = document.getElementById("cameraSelect").value;
      const micId = document.getElementById("micSelect").value;
      const quality = qualitySelect.value;

      // Record screen if enabled
      if (screenCheckbox.checked) {
        await recordScreen(micId, quality);
      }

      // Record camera if enabled
      if (videoCheckbox.checked) {
        await recordCamera(cameraId, quality);
      }

      // Record audio only if needed
      if (
        audioCheckbox.checked &&
        (!screenCheckbox.checked || !videoCheckbox.checked)
      ) {
        await recordAudioOnly(micId, quality);
      }

      statusText.textContent = "Recording...";
    } catch (error) {
      console.error("Recording error:", error);
      statusText.textContent = `Error: ${error.message}`;
      await stopRecording();
    }
  }

  async function recordScreen(micId, quality) {
    const response = await chrome.runtime.sendMessage({
      action: "getScreenStream",
    });
    if (!response?.streamId) throw new Error("Screen sharing canceled");

    const constraints = {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: response.streamId,
          ...qualityPresets[quality].video,
        },
      },
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    screenPreview.srcObject = stream;
    screenPreview.style.objectFit = "contain"; // Fix scaling

    // Record video track only
    const videoRecorder = new MediaRecorder(
      new MediaStream(stream.getVideoTracks()),
      {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 2500000,
      }
    );

    setupRecorder(videoRecorder, "screen-video");
    mediaRecorders.push(videoRecorder);
    mediaStreams.push(stream);
  }

  async function recordCamera(cameraId, quality) {
    const constraints = {
      video: {
        deviceId: cameraId ? { exact: cameraId } : undefined,
        ...qualityPresets[quality].video,
      },
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Record video track only
    const videoRecorder = new MediaRecorder(
      new MediaStream(stream.getVideoTracks()),
      {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 2500000,
      }
    );

    setupRecorder(videoRecorder, "camera-video");
    mediaRecorders.push(videoRecorder);
    mediaStreams.push(stream);
  }

  async function recordAudioOnly(micId, quality) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: micId ? { exact: micId } : undefined,
        ...qualityPresets[quality].audio,
      },
    });

    const audioRecorder = new MediaRecorder(
      new MediaStream(stream.getAudioTracks()),
      {
        mimeType: "audio/webm",
        audioBitsPerSecond: qualityPresets[quality].audio.bitrate,
      }
    );

    setupRecorder(audioRecorder, "audio");
    mediaRecorders.push(audioRecorder);
    mediaStreams.push(stream);
  }

  function setupRecorder(recorder, type) {
    const chunks = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => saveRecording(chunks, type);
    recorder.start(100);
  }

  function saveRecording(chunks, type) {
    const blob = new Blob(chunks, { type: chunks[0].type });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    let filename, ext;

    if (type.includes("video")) {
      ext = "webm";
      filename = `${type}-${timestamp}.${ext}`;
    } else {
      ext = "webm";
      filename = `audio-${timestamp}.${ext}`;
    }

    chrome.downloads.download({ url, filename });
  }

  async function stopRecording() {
    isRecording = false;
    recordBtn.textContent = "Start Recording";
    statusText.textContent = "Stopping recording...";

    // Stop all recorders
    mediaRecorders.forEach((recorder) => {
      if (recorder.state !== "inactive") recorder.stop();
    });

    // Stop all streams except previews
    mediaStreams.forEach((stream) => {
      if (
        stream !== cameraPreview.srcObject &&
        stream !== screenPreview.srcObject
      ) {
        stream.getTracks().forEach((track) => track.stop());
      }
    });

    mediaRecorders = [];
    mediaStreams = mediaStreams.filter(
      (s) => s === cameraPreview.srcObject || s === screenPreview.srcObject
    );

    statusText.textContent = "Recording stopped";
  }

  function updateUI() {
    if (screenCheckbox.checked) {
      screenPreview.style.display = "block";
    } else {
      screenPreview.style.display = "none";
    }

    if (videoCheckbox.checked) {
      cameraPreview.style.display = "block";
    } else {
      cameraPreview.style.display = "none";
    }

    if (audioCheckbox.checked) {
      audioMeter.style.display = "block";
    } else {
      audioMeter.style.display = "none";
    }
  }

  // Event listeners
  audioCheckbox.addEventListener("change", () => {
    updateUI();
    if (audioCheckbox.checked) setupAudioMeter();
  });

  videoCheckbox.addEventListener("change", () => {
    updateUI();
    if (videoCheckbox.checked) startPreviews();
  });

  screenCheckbox.addEventListener("change", updateUI);
  recordBtn.addEventListener("click", toggleRecording);

  document
    .getElementById("cameraSelect")
    .addEventListener("change", startPreviews);
  document.getElementById("micSelect").addEventListener("change", () => {
    if (audioCheckbox.checked) setupAudioMeter();
  });

  // Initial button style
  updateButtonStyle();
});
