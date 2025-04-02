import { checkPermissions, loadDevices } from "../permissions.js";
import { setupEventListeners } from "../eventListeners.js";

document.addEventListener("DOMContentLoaded", async () => {
  await checkPermissions();
  await loadDevices();
  setupEventListeners();
});
