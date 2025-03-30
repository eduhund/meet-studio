document.addEventListener("DOMContentLoaded", () => {
  // UI Elements
  const audioCheckbox = document.getElementById("audioCheckbox");
  const videoCheckbox = document.getElementById("videoCheckbox");
  const screenCheckbox = document.getElementById("screenCheckbox");
  const separateAudioCheckbox = document.getElementById(
    "separateAudioCheckbox"
  );
  const recordBtn = document.getElementById("recordBtn");
  const statusText = document.getElementById("statusText");
  const cameraPreview = document.getElementById("cameraPreview");
  const screenPreview = document.getElementById("screenPreview");
  const audioMeter = document.getElementById("audioMeter");
  const cameraSelect = document.getElementById("cameraSelect");
  const micSelect = document.getElementById("micSelect");
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
    cameraSelect.innerHTML = videoDevices
      .map(
        (device) =>
          `<option value="${device.deviceId}">${
            device.label || `Camera ${cameraSelect.length + 1}`
          }</option>`
      )
      .join("");

    // Update microphone select
    micSelect.innerHTML = audioDevices
      .map(
        (device) =>
          `<option value="${device.deviceId}">${
            device.label || `Mic ${micSelect.length + 1}`
          }</option>`
      )
      .join("");
  }

  async function startPreviews() {
    try {
      // Start camera preview if enabled
      if (videoCheckbox.checked) {
        const constraints = {
          video: {
            deviceId: cameraSelect.value
              ? { exact: cameraSelect.value }
              : undefined,
            ...qualityPresets[qualitySelect.value].video,
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraPreview.srcObject = stream;
        mediaStreams.push(stream);
      }

      // Start audio meter if audio enabled and not recording
      if (audioCheckbox.checked && !isRecording) {
        await setupAudioMeter();
      }
    } catch (error) {
      console.error("Preview error:", error);
    }
  }

  async function setupAudioMeter() {
    try {
      if (analyser) {
        microphone.disconnect();
        audioContext.close();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: micSelect.value ? { exact: micSelect.value } : undefined,
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
    audioMeter.style.width = `${Math.min(100, avg)}%`;

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
    recordBtn.classList.toggle("recording", isRecording);
    recordBtn.classList.toggle("not-recording", !isRecording);
  }

  async function startRecording() {
    try {
      isRecording = true;
      recordBtn.textContent = "Stop Recording";
      statusText.textContent = "Starting recording...";

      mediaRecorders = [];
      const quality = qualitySelect.value;
      const shouldSeparateAudio =
        separateAudioCheckbox.checked &&
        audioCheckbox.checked &&
        (videoCheckbox.checked || screenCheckbox.checked);

      // Record screen if enabled
      if (screenCheckbox.checked) {
        await recordScreen(quality, shouldSeparateAudio);
      }

      // Record camera if enabled
      if (videoCheckbox.checked) {
        await recordCamera(quality, shouldSeparateAudio);
      }

      // Record audio only if needed
      if (
        audioCheckbox.checked &&
        !shouldSeparateAudio &&
        !screenCheckbox.checked &&
        !videoCheckbox.checked
      ) {
        await recordAudioOnly(quality);
      }

      statusText.textContent = "Recording...";
    } catch (error) {
      console.error("Recording error:", error);
      statusText.textContent = `Error: ${error.message}`;
      await stopRecording();
    }
  }

  async function recordScreen(quality, separateAudio) {
    const response = await chrome.runtime.sendMessage({
      action: "getScreenStream",
    });
    if (!response?.streamId) throw new Error("Screen sharing canceled");

    const constraints = {
      audio: separateAudio ? false : audioCheckbox.checked,
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

    if (separateAudio && audioCheckbox.checked) {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: micSelect.value ? { exact: micSelect.value } : undefined,
          ...qualityPresets[quality].audio,
        },
      });

      // Record combined video
      const videoRecorder = new MediaRecorder(
        new MediaStream(stream.getVideoTracks()),
        { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 2500000 }
      );

      // Record separate audio
      const audioRecorder = new MediaRecorder(
        new MediaStream(audioStream.getAudioTracks()),
        {
          mimeType: "audio/webm",
          audioBitsPerSecond: qualityPresets[quality].audio.bitrate,
        }
      );

      setupRecorder(videoRecorder, "screen-video");
      setupRecorder(audioRecorder, "screen-audio");
      mediaRecorders.push(videoRecorder, audioRecorder);
      mediaStreams.push(stream, audioStream);
    } else {
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        audioBitsPerSecond: audioCheckbox.checked
          ? qualityPresets[quality].audio.bitrate
          : 0,
        videoBitsPerSecond: 2500000,
      });

      setupRecorder(recorder, "screen");
      mediaRecorders.push(recorder);
      mediaStreams.push(stream);
    }
  }

  async function recordCamera(quality, separateAudio) {
    const constraints = {
      video: {
        deviceId: cameraSelect.value
          ? { exact: cameraSelect.value }
          : undefined,
        ...qualityPresets[quality].video,
      },
      audio: separateAudio ? false : audioCheckbox.checked,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    if (separateAudio && audioCheckbox.checked) {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: micSelect.value ? { exact: micSelect.value } : undefined,
          ...qualityPresets[quality].audio,
        },
      });

      // Record video only
      const videoRecorder = new MediaRecorder(
        new MediaStream(stream.getVideoTracks()),
        { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 2500000 }
      );

      // Record audio only
      const audioRecorder = new MediaRecorder(
        new MediaStream(audioStream.getAudioTracks()),
        {
          mimeType: "audio/webm",
          audioBitsPerSecond: qualityPresets[quality].audio.bitrate,
        }
      );

      setupRecorder(videoRecorder, "camera-video");
      setupRecorder(audioRecorder, "camera-audio");
      mediaRecorders.push(videoRecorder, audioRecorder);
      mediaStreams.push(stream, audioStream);
    } else {
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        audioBitsPerSecond: audioCheckbox.checked
          ? qualityPresets[quality].audio.bitrate
          : 0,
        videoBitsPerSecond: 2500000,
      });

      setupRecorder(recorder, "camera");
      mediaRecorders.push(recorder);
      mediaStreams.push(stream);
    }
  }

  async function recordAudioOnly(quality) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: micSelect.value ? { exact: micSelect.value } : undefined,
        ...qualityPresets[quality].audio,
      },
    });

    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm",
      audioBitsPerSecond: qualityPresets[quality].audio.bitrate,
    });

    setupRecorder(recorder, "audio");
    mediaRecorders.push(recorder);
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
    const ext = type.includes("audio") ? "webm" : "webm";
    const filename = `${type}-${timestamp}.${ext}`;

    chrome.downloads.download({ url, filename });
  }

  async function stopRecording() {
    isRecording = false;
    recordBtn.textContent = "Start Recording";
    statusText.textContent = "Stopping recording...";

    mediaRecorders.forEach(
      (recorder) => recorder.state !== "inactive" && recorder.stop()
    );
    mediaRecorders = [];

    // Restart audio meter if needed
    if (audioCheckbox.checked) {
      await setupAudioMeter();
    }

    statusText.textContent = "Recording stopped";
  }

  function updateUI() {
    // Show/hide previews
    cameraPreview.style.display = videoCheckbox.checked ? "block" : "none";
    screenPreview.style.display = screenCheckbox.checked ? "block" : "none";

    // Update separate audio checkbox visibility
    separateAudioCheckbox.parentElement.style.display =
      audioCheckbox.checked && (videoCheckbox.checked || screenCheckbox.checked)
        ? "block"
        : "none";

    // Update device selects availability
    cameraSelect.disabled = !videoCheckbox.checked;
    micSelect.disabled = !audioCheckbox.checked;
  }

  // Event listeners
  audioCheckbox.addEventListener("change", () => {
    updateUI();
    if (audioCheckbox.checked) setupAudioMeter();
    else if (analyser) {
      microphone.disconnect();
      audioContext.close();
      analyser = null;
    }
  });

  videoCheckbox.addEventListener("change", () => {
    updateUI();
    if (videoCheckbox.checked) startPreviews();
    else if (cameraPreview.srcObject) {
      cameraPreview.srcObject.getTracks().forEach((track) => track.stop());
      cameraPreview.srcObject = null;
    }
  });

  screenCheckbox.addEventListener("change", updateUI);
  recordBtn.addEventListener("click", toggleRecording);

  cameraSelect.addEventListener("change", startPreviews);
  micSelect.addEventListener(
    "change",
    () => audioCheckbox.checked && setupAudioMeter()
  );
  qualitySelect.addEventListener("change", () => {
    if (videoCheckbox.checked) startPreviews();
    if (audioCheckbox.checked) setupAudioMeter();
  });

  // Initial setup
  updateButtonStyle();
  updateUI();
});
