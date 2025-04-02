export function getDateTimeFilename(source, extension) {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, "-");
  return `${dateStr}-${source}.${extension}`;
}

export function mergeAudioAndVideo(audioBlob, videoBlob) {
  return new Promise((resolve) => {
    resolve(videoBlob); // Placeholder: merging to be handled by external tool or ffmpeg.wasm
  });
}
