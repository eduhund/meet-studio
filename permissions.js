export async function checkPermissions() {
  try {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    const cam = await navigator.mediaDevices.getUserMedia({ video: true });
    mic.getTracks().forEach((t) => t.stop());
    cam.getTracks().forEach((t) => t.stop());
    return true;
  } catch (e) {
    return false;
  }
}
