const form = document.getElementById("linkForm");
const labelInput = document.getElementById("linkLabel");
const urlInput = document.getElementById("linkUrl");
const linksList = document.getElementById("linksList");
const linkDeleteBtn = document.getElementById("linkDelete");
const linkCancelBtn = document.getElementById("linkCancel");
const formToggle = document.getElementById("linkFormToggle");
const formWrap = document.getElementById("linkFormWrap");

const STORAGE_KEY = "quickLinks";

let links = [];
let editingId = null;
let formOpen = false;

function loadLinks() {
  const data = loadData(STORAGE_KEY, []);
  return Array.isArray(data) ? data : [];
}

function saveLinks() {
  saveData(STORAGE_KEY, links);
}

function normalizeUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function renderLinks() {
  linksList.innerHTML = "";
  if (links.length === 0) {
    linksList.innerHTML = `<div class="link-item">No links yet.</div>`;
    return;
  }

  links.forEach((link) => {
    const item = document.createElement("div");
    item.className = "link-item";
    item.innerHTML = `
      <div class="link-header">
        <div class="link-title">${link.label}</div>
        <div class="link-actions">
          <a class="btn" href="${link.url}" target="_blank" rel="noreferrer">Open</a>
          <button class="btn" data-edit="${link.id}" type="button">Edit</button>
        </div>
      </div>
      <div class="link-url">${link.url}</div>
    `;
    linksList.appendChild(item);
  });
}

function addLink(event) {
  event.preventDefault();
  const label = labelInput.value.trim();
  const url = normalizeUrl(urlInput.value);
  if (!label || !url) return;
  if (editingId) {
    const link = links.find((item) => item.id === editingId);
    if (link) {
      link.label = label;
      link.url = url;
    }
  } else {
    links.unshift({
      id: crypto.randomUUID(),
      label,
      url,
      createdAt: new Date().toISOString(),
    });
  }
  saveLinks();
  renderLinks();
  form.reset();
  editingId = null;
  linkDeleteBtn.classList.add("hidden");
  setFormOpen(false);
}

form.addEventListener("submit", addLink);
linksList.addEventListener("click", (event) => {
  const target = event.target;
  if (target.matches("button[data-edit]")) {
    const link = links.find((item) => item.id === target.dataset.edit);
    if (link) {
      labelInput.value = link.label;
      urlInput.value = link.url;
      editingId = link.id;
      linkDeleteBtn.classList.remove("hidden");
      setFormOpen(true);
    }
  }
});

initStorage().then(() => {
  links = loadLinks();
  renderLinks();
  linkDeleteBtn.classList.add("hidden");
});

linkDeleteBtn.addEventListener("click", () => {
  if (!editingId) return;
  if (!confirm("Delete this link?")) return;
  links = links.filter((link) => link.id !== editingId);
  editingId = null;
  saveLinks();
  renderLinks();
  form.reset();
  linkDeleteBtn.classList.add("hidden");
  setFormOpen(false);
});

linkCancelBtn.addEventListener("click", () => {
  editingId = null;
  form.reset();
  linkDeleteBtn.classList.add("hidden");
  setFormOpen(false);
});

function setFormOpen(open) {
  if (!formWrap || !formToggle) return;
  formOpen = open;
  formWrap.classList.toggle("collapsed", !open);
  formToggle.setAttribute("aria-expanded", String(open));
}

if (formToggle && formWrap) {
  setFormOpen(false);
  formToggle.addEventListener("click", () => setFormOpen(!formOpen));
  formWrap.addEventListener("focusin", () => setFormOpen(true));
}
