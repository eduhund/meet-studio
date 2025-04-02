let mediaRecorder;
let recordedChunks = [];
let startTime;

/**
 * Starts media recording.
 */
export function startRecording() {
  const recordButton = document.getElementById("record-button");
  recordButton.textContent = "Stop Recording";
  recordButton.classList.add("recording");
  startTime = new Date();

  const streams = [];
  // Add selected tracks to streams
  // ...

  const combinedStream = new MediaStream(streams);
  mediaRecorder = new MediaRecorder(combinedStream);
  recordedChunks = [];

  mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);
  mediaRecorder.onstop = saveRecording;
  mediaRecorder.start();
}

/**
 * Stops recording and saves the file.
 */
export function stopRecording() {
  const recordButton = document.getElementById("record-button");
  recordButton.textContent = "Start Recording";
  recordButton.classList.remove("recording");
  mediaRecorder.stop();
}

/**
 * Saves recording to disk.
 */
function saveRecording() {
  const blob = new Blob(recordedChunks, { type: "video/mp4" });
  const fileName = `${startTime
    .toISOString()
    .replace(/[:.]/g, "-")}_recording.mp4`;
  const url = URL.createObjectURL(blob);

  chrome.downloads.download({
    url: url,
    filename: fileName,
    saveAs: true,
  });
}
