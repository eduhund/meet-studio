export function createVolumeIndicator(container, recorder) {
  const existing = container.querySelector(".volume-bar");
  if (existing) existing.remove();

  const bar = document.createElement("div");
  bar.className = "volume-bar";
  const level = document.createElement("div");
  level.className = "volume-level";
  bar.appendChild(level);
  container.appendChild(bar);

  const interval = setInterval(() => {
    const value = recorder.getLevel();
    level.style.width = `${Math.floor(value * 100)}%`;
  }, 100);

  recorder._volumeInterval = interval;
}
