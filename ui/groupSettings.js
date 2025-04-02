export function createGroupSettings(id, labelText, onToggle, isVisible) {
  const container = document.getElementById(id);
  container.innerHTML = "";

  if (!isVisible()) return;

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "8px";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = false;

  const label = document.createElement("label");
  label.textContent = labelText;

  checkbox.onchange = () => {
    onToggle(checkbox.checked);
  };

  row.appendChild(checkbox);
  row.appendChild(label);
  container.appendChild(row);
}
