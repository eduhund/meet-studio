import { startRecording, stopRecording } from "./recording.js";

/**
 * Sets up UI event listeners.
 */
export function setupEventListeners() {
  const recordButton = document.getElementById("record-button");
  recordButton.addEventListener("click", toggleRecording);

  document
    .getElementById("screen-toggle")
    .addEventListener("change", async (e) => {
      if (e.target.checked) {
        await selectScreenSource();
      }
    });
}

/**
 * Toggles recording state.
 */
function toggleRecording() {
  const recordButton = document.getElementById("record-button");
  if (recordButton.classList.contains("recording")) {
    stopRecording();
  } else {
    startRecording();
  }
}

/**
 * Handles screen source selection.
 */
async function selectScreenSource() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: document.getElementById("audio-toggle").checked,
    });
    const screenPreview = document.getElementById("screen-preview");
    screenPreview.srcObject = stream;
    document.getElementById("screen-name").textContent = "Screen selected";
  } catch (error) {
    document.getElementById("screen-toggle").checked = false;
  }
}
