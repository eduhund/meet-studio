export function createSourceBlock(
  label,
  devices,
  enabledByDefault,
  container,
  onChange
) {
  const title = document.createElement("div");
  title.textContent = label;

  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = enabledByDefault;

  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.justifyContent = "space-between";
  row.style.alignItems = "center";
  row.append(title, toggle);

  container.innerHTML = "";
  container.appendChild(row);

  if (devices.length > 1) {
    const select = document.createElement("select");
    devices.forEach((d) => {
      const option = document.createElement("option");
      option.value = d.deviceId;
      option.textContent = d.label || `${label} ${d.deviceId}`;
      select.appendChild(option);
    });
    container.appendChild(select);
    onChange(toggle.checked, select.value);
    toggle.onchange = () => onChange(toggle.checked, select.value);
    select.onchange = () => onChange(toggle.checked, select.value);
  } else {
    const info = document.createElement("div");
    info.textContent = devices[0]?.label || `${label} device`;
    container.appendChild(info);
    onChange(toggle.checked, devices[0]?.deviceId || null);
    toggle.onchange = () =>
      onChange(toggle.checked, devices[0]?.deviceId || null);
  }
}
