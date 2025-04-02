export function createVideoPreview(container, stream) {
  const existing = container.querySelector("video");
  if (existing) existing.remove();

  const video = document.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.className = "preview";
  video.srcObject = stream;
  container.appendChild(video);
}
