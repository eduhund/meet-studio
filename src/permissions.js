/**
 * Checks if required permissions are granted.
 */
export async function checkPermissions() {
  const statusElement = document.getElementById("permission-status");
  const recordButton = document.getElementById("record-button");

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasMic = devices.some((device) => device.kind === "audioinput");
    const hasCamera = devices.some((device) => device.kind === "videoinput");

    if (!hasMic || !hasCamera) {
      statusElement.textContent = "Microphone and camera permissions required";
      recordButton.disabled = true;
    } else {
      statusElement.textContent = "Permissions granted. Ready to record!";
      recordButton.disabled = false;
    }
  } catch (error) {
    statusElement.textContent = "Error checking permissions";
    recordButton.disabled = true;
  }
}

/**
 * Loads available media devices into dropdowns.
 */
export async function loadDevices() {
  const micSelect = document.getElementById("mic-select");
  const cameraSelect = document.getElementById("camera-select");
  const audioSelect = document.getElementById("audio-select");

  const devices = await navigator.mediaDevices.enumerateDevices();

  // Microphones
  const mics = devices.filter((device) => device.kind === "audioinput");
  micSelect.innerHTML = mics
    .map(
      (device) =>
        `<option value="${device.deviceId}">${
          device.label || "Microphone"
        }</option>`
    )
    .join("");

  // Cameras
  const cameras = devices.filter((device) => device.kind === "videoinput");
  cameraSelect.innerHTML = cameras
    .map(
      (device) =>
        `<option value="${device.deviceId}">${
          device.label || "Camera"
        }</option>`
    )
    .join("");

  // System audio
  const audioOutputs = devices.filter(
    (device) => device.kind === "audiooutput"
  );
  audioSelect.innerHTML = audioOutputs
    .map(
      (device) =>
        `<option value="${device.deviceId}">${
          device.label || "System Audio"
        }</option>`
    )
    .join("");

  // Start default camera preview
  if (cameras.length > 0) {
    startCameraPreview();
  }
}

/**
 * Starts camera preview stream.
 */
async function startCameraPreview() {
  const cameraSelect = document.getElementById("camera-select");
  const cameraPreview = document.getElementById("camera-preview");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: cameraSelect.value },
    });
    cameraPreview.srcObject = stream;
  } catch (error) {
    // Handle error silently
  }
}
