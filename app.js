const photos = window.PEAK_PHOTOS ?? [];
const baseIdeas = window.PEAK_IDEAS ?? [];
const editMode = new URLSearchParams(window.location.search).get("edit") === "1";
const storageKey = "peak-ideas-draft-v1";

let ideas = editMode ? loadDraftIdeas() : baseIdeas;
let currentIdeaId = null;
let pendingLocation = null;
let currentUploadData = "";
let currentUploadName = "";

const elements = {
  ideaCount: document.querySelector("#idea-count"),
  fitMap: document.querySelector("#fit-map"),
  addIdea: document.querySelector("#add-idea"),
  exportIdeas: document.querySelector("#export-ideas"),
  panel: document.querySelector("#idea-panel"),
  form: document.querySelector("#idea-form"),
  panelTitle: document.querySelector("#panel-title"),
  closePanel: document.querySelector("#close-panel"),
  deleteIdea: document.querySelector("#delete-idea"),
  title: document.querySelector("#idea-title"),
  category: document.querySelector("#idea-category"),
  icon: document.querySelector("#idea-icon"),
  photo: document.querySelector("#idea-photo"),
  upload: document.querySelector("#idea-upload"),
  preview: document.querySelector("#photo-preview"),
  suggestion: document.querySelector("#idea-suggestion"),
  pros: document.querySelector("#idea-pros"),
  editTab: document.querySelector("#edit-tab"),
  dataTab: document.querySelector("#data-tab"),
  copyExport: document.querySelector("#copy-export"),
  exportBox: document.querySelector("#export-box"),
  exportOutput: document.querySelector("#export-output"),
  emptyState: document.querySelector("#empty-state"),
};

const photoById = new Map(photos.map((photo) => [photo.id, photo]));
const categories = {
  Signage: "#0f5132",
  "Guest flow": "#0b5c75",
  "Secondary spend": "#8a4b12",
  "Wet weather": "#2856a3",
  Retail: "#7a2f5d",
  Safety: "#8a1f1f",
  Operations: "#334155",
};

const icons = {
  sign: { label: "Sign", symbol: "S", color: "#0f5132" },
  bin: { label: "Bin", symbol: "B", color: "#4b5563" },
  kiosk: { label: "Kiosk", symbol: "K", color: "#9a5b13" },
  shop: { label: "Shop", symbol: "R", color: "#7a2f5d" },
  food: { label: "Food", symbol: "F", color: "#b45309" },
  shelter: { label: "Shelter", symbol: "W", color: "#2856a3" },
  path: { label: "Path", symbol: "P", color: "#0b5c75" },
  warning: { label: "Warning", symbol: "!", color: "#8a1f1f" },
  staff: { label: "Staff", symbol: "O", color: "#334155" },
  idea: { label: "Idea", symbol: "I", color: "#123d2c" },
};

function ideaIconKey(idea) {
  if (idea.icon && icons[idea.icon]) return idea.icon;
  if (idea.category === "Signage") return "sign";
  if (idea.category === "Guest flow") return "path";
  if (idea.category === "Secondary spend") return "kiosk";
  if (idea.category === "Wet weather") return "shelter";
  if (idea.category === "Retail") return "shop";
  if (idea.category === "Safety") return "warning";
  if (idea.category === "Operations") return "staff";
  return "idea";
}

function loadDraftIdeas() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    return Array.isArray(saved) ? saved : baseIdeas;
  } catch {
    return baseIdeas;
  }
}

function saveDraftIdeas() {
  localStorage.setItem(storageKey, JSON.stringify(ideas));
}

function photoLabel(photo) {
  return photo?.title || photo?.originalName || photo?.id || "No photo";
}

function formatShotAt(photo) {
  if (!photo?.shotAt) return "Time not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(photo.shotAt));
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function googleMapsUrl(point) {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
}

function nearestPhoto(latlng) {
  let best = null;
  let bestDistance = Infinity;

  photos.forEach((photo) => {
    const distance = map.distance(latlng, [photo.lat, photo.lng]);
    if (distance < bestDistance) {
      best = photo;
      bestDistance = distance;
    }
  });

  return best;
}

function ideaPhoto(idea) {
  return photoById.get(idea.photoId) ?? null;
}

function ideaIcon(idea) {
  const icon = icons[ideaIconKey(idea)] ?? icons.idea;
  const color = icon.color ?? categories[idea.category] ?? categories.Operations;
  return L.divIcon({
    className: "idea-pin-wrap",
    html: `<div class="idea-pin" style="--pin-color: ${color}"><span>${icon.symbol}</span></div>`,
    iconSize: [42, 54],
    iconAnchor: [21, 54],
    popupAnchor: [0, -50],
  });
}

function photoDotIcon(photo) {
  return L.divIcon({
    className: "source-photo-wrap",
    html: `<button class="source-photo" type="button" title="${photoLabel(photo)}"><img src="${photo.thumb}" alt="" /></button>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function popupContent(idea) {
  const photo = ideaPhoto(idea);
  const uploadedPhoto = idea.photoData
    ? { src: idea.photoData, label: idea.photoName || "Uploaded photo" }
    : null;
  const photoSrc = uploadedPhoto?.src ?? photo?.photo;
  const photoAlt = uploadedPhoto?.label ?? photoLabel(photo);
  const pros = (idea.pros ?? [])
    .filter(Boolean)
    .map((pro) => `<li>${pro}</li>`)
    .join("");
  const editButton = editMode
    ? `<button class="popup-edit" type="button" data-edit-idea="${idea.id}">Edit this pin</button>`
    : "";

  return `
    <article class="idea-popup">
      ${photoSrc ? `<img src="${photoSrc}" alt="${photoAlt}" loading="lazy" />` : ""}
      <div class="idea-popup__body">
        <p class="idea-category">${idea.category || "Idea"}</p>
        <h2>${idea.title || "Untitled idea"}</h2>
        ${uploadedPhoto ? `<p class="photo-meta">${uploadedPhoto.label}</p>` : ""}
        ${!uploadedPhoto && photo ? `<p class="photo-meta">${photo.originalName} · ${formatShotAt(photo)}</p>` : ""}
        ${idea.suggestion ? `<p>${idea.suggestion}</p>` : ""}
        ${pros ? `<ul>${pros}</ul>` : ""}
        <div class="popup-links">
          <a href="${googleMapsUrl(idea)}" target="_blank" rel="noreferrer">Open in Google Maps</a>
          ${editButton}
        </div>
      </div>
    </article>
  `;
}

const map = L.map("map", {
  fadeAnimation: false,
  preferCanvas: true,
  zoomControl: false,
  scrollWheelZoom: true,
});

L.control.zoom({ position: "bottomright" }).addTo(map);

const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    keepBuffer: 6,
    maxZoom: 20,
    updateWhenIdle: false,
    updateWhenZooming: false,
    attribution:
      "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  }
).addTo(map);

const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  keepBuffer: 6,
  maxZoom: 20,
  updateWhenIdle: false,
  updateWhenZooming: false,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
});

const transportOverlay = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
  {
    keepBuffer: 6,
    maxZoom: 20,
    opacity: 0.9,
    attribution: "Roads & paths &copy; Esri",
  }
).addTo(map);

const labelOverlay = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  {
    keepBuffer: 6,
    maxZoom: 20,
    opacity: 0.82,
    attribution: "Labels &copy; Esri",
  }
).addTo(map);

const ideaLayer = L.layerGroup().addTo(map);
const sourcePhotoLayer = L.layerGroup();

L.control
  .layers(
    { Satellite: satellite, "Street map": street },
    {
      "Paths / roads overlay": transportOverlay,
      "Labels overlay": labelOverlay,
      ...(editMode ? { "Source photo locations": sourcePhotoLayer } : {}),
    },
    { position: "bottomleft" }
  )
  .addTo(map);

if (editMode) {
  photos.forEach((photo) => {
    const marker = L.marker([photo.lat, photo.lng], { icon: photoDotIcon(photo) });
    marker.on("click", () => {
      pendingLocation = { lat: photo.lat, lng: photo.lng };
      openEditor({
        lat: photo.lat,
        lng: photo.lng,
        photoId: photo.id,
        icon: "sign",
        title: "",
        category: "Signage",
        suggestion: "",
        pros: [],
      });
    });
    sourcePhotoLayer.addLayer(marker);
  });
}

function renderIdeas() {
  ideaLayer.clearLayers();

  ideas.forEach((idea) => {
    const marker = L.marker([idea.lat, idea.lng], {
      icon: ideaIcon(idea),
      title: idea.title,
    });
    marker.bindPopup(popupContent(idea), { maxWidth: 420 });
    ideaLayer.addLayer(marker);
  });

  elements.ideaCount.textContent = `${ideas.length} idea ${ideas.length === 1 ? "pin" : "pins"}`;
  elements.emptyState.hidden = ideas.length > 0;
}

function fitMap() {
  const points = ideas.length > 0 ? ideas : photos;

  if (points.length === 0) {
    map.setView([53.0612, -1.9239], 17);
    return;
  }

  map.fitBounds(L.latLngBounds(points.map((point) => [point.lat, point.lng])), {
    padding: [48, 48],
    maxZoom: ideas.length > 0 ? 18 : 17,
  });
}

function populatePhotoOptions() {
  elements.photo.innerHTML = photos
    .map(
      (photo) =>
        `<option value="${photo.id}">${formatShotAt(photo)} · ${photo.originalName}</option>`
    )
    .join("");
}

function updatePhotoPreview() {
  if (currentUploadData) {
    elements.preview.hidden = false;
    elements.preview.src = currentUploadData;
    elements.preview.alt = currentUploadName || "Uploaded pin photo";
    return;
  }

  const photo = photoById.get(elements.photo.value);
  elements.preview.hidden = !photo;
  if (photo) {
    elements.preview.src = photo.thumb;
    elements.preview.alt = photoLabel(photo);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function resizeImageFile(file) {
  const originalDataUrl = await fileToDataUrl(file);

  try {
    const image = new Image();
    image.decoding = "async";
    image.src = originalDataUrl;
    await image.decode();

    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.round(image.naturalWidth * scale);
    const height = Math.round(image.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return originalDataUrl;
  }
}

function openEditor(idea = null) {
  currentIdeaId = idea?.id ?? null;
  pendingLocation = idea ? { lat: idea.lat, lng: idea.lng } : pendingLocation;

  elements.panel.hidden = false;
  elements.exportBox.hidden = true;
  elements.panelTitle.textContent = currentIdeaId ? "Edit idea" : "Add idea";
  elements.deleteIdea.hidden = !currentIdeaId;
  currentUploadData = idea?.photoData ?? "";
  currentUploadName = idea?.photoName ?? "";

  elements.title.value = idea?.title ?? "";
  elements.category.value = idea?.category ?? "Signage";
  elements.icon.value = ideaIconKey(idea ?? { category: "Signage" });
  elements.photo.value = idea?.photoId ?? nearestPhoto(pendingLocation)?.id ?? photos[0]?.id ?? "";
  elements.upload.value = "";
  elements.suggestion.value = idea?.suggestion ?? "";
  elements.pros.value = (idea?.pros ?? []).join("\n");
  updatePhotoPreview();
}

function closeEditor() {
  elements.panel.hidden = true;
  currentIdeaId = null;
  pendingLocation = null;
}

function exportIdeas() {
  const exportBlock = `window.PEAK_IDEAS = ${JSON.stringify(ideas, null, 2)};\n`;
  elements.panel.hidden = false;
  elements.exportBox.hidden = false;
  elements.dataTab.classList.add("is-active");
  elements.editTab.classList.remove("is-active");
  elements.exportOutput.value = exportBlock;
  elements.exportOutput.focus();
  elements.exportOutput.select();
}

function settleMap() {
  map.invalidateSize(false);
  fitMap();
}

populatePhotoOptions();
renderIdeas();
fitMap();

[0, 100, 350, 900, 1800].forEach((delay) => {
  setTimeout(settleMap, delay);
});

window.addEventListener("load", settleMap);
window.addEventListener("resize", settleMap);
window.addEventListener("orientationchange", () => setTimeout(settleMap, 250));

elements.fitMap.addEventListener("click", fitMap);
elements.photo.addEventListener("change", updatePhotoPreview);
elements.upload.addEventListener("change", async () => {
  const file = elements.upload.files?.[0];
  if (!file) return;

  elements.preview.hidden = false;
  elements.preview.removeAttribute("src");
  elements.preview.alt = "Processing uploaded photo...";

  currentUploadData = await resizeImageFile(file);
  currentUploadName = file.name;
  updatePhotoPreview();
});
elements.closePanel.addEventListener("click", closeEditor);
elements.exportIdeas.addEventListener("click", exportIdeas);
elements.dataTab.addEventListener("click", exportIdeas);
elements.editTab.addEventListener("click", () => {
  elements.exportBox.hidden = true;
  elements.editTab.classList.add("is-active");
  elements.dataTab.classList.remove("is-active");
});
elements.copyExport.addEventListener("click", async () => {
  exportIdeas();
  try {
    await navigator.clipboard.writeText(elements.exportOutput.value);
    elements.copyExport.textContent = "Copied";
    setTimeout(() => {
      elements.copyExport.textContent = "Copy all data";
    }, 1500);
  } catch {
    elements.exportOutput.focus();
    elements.exportOutput.select();
  }
});

elements.addIdea.addEventListener("click", () => {
  pendingLocation = null;
  map.getContainer().classList.add("is-placing");
  elements.ideaCount.textContent = "Click the map to place a new idea";
});

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!pendingLocation && !currentIdeaId) return;

  const existing = ideas.find((idea) => idea.id === currentIdeaId);
  const lat = existing?.lat ?? pendingLocation.lat;
  const lng = existing?.lng ?? pendingLocation.lng;
  const title = elements.title.value.trim() || "Untitled idea";
  const nextIdea = {
    id: existing?.id ?? `${slugify(title) || "idea"}-${Date.now().toString(36)}`,
    title,
    category: elements.category.value,
    icon: elements.icon.value,
    lat: Number(lat.toFixed(8)),
    lng: Number(lng.toFixed(8)),
    photoId: elements.photo.value,
    ...(currentUploadData
      ? {
          photoName: currentUploadName,
          photoData: currentUploadData,
        }
      : {}),
    suggestion: elements.suggestion.value.trim(),
    pros: elements.pros.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };

  ideas = existing
    ? ideas.map((idea) => (idea.id === existing.id ? nextIdea : idea))
    : [...ideas, nextIdea];

  saveDraftIdeas();
  renderIdeas();
  closeEditor();
  fitMap();
});

elements.deleteIdea.addEventListener("click", () => {
  if (!currentIdeaId) return;
  ideas = ideas.filter((idea) => idea.id !== currentIdeaId);
  saveDraftIdeas();
  renderIdeas();
  closeEditor();
});

map.on("click", (event) => {
  if (!editMode || !map.getContainer().classList.contains("is-placing")) return;
  map.getContainer().classList.remove("is-placing");
  pendingLocation = {
    lat: event.latlng.lat,
    lng: event.latlng.lng,
  };
  openEditor({
    lat: pendingLocation.lat,
    lng: pendingLocation.lng,
    photoId: nearestPhoto(event.latlng)?.id,
    icon: "sign",
    title: "",
    category: "Signage",
    suggestion: "",
    pros: [],
  });
});

document.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-idea]");
  if (!editButton) return;
  const idea = ideas.find((item) => item.id === editButton.dataset.editIdea);
  if (idea) openEditor(idea);
});

if (!editMode) {
  elements.addIdea.hidden = true;
  elements.exportIdeas.hidden = true;
} else {
  document.body.classList.add("edit-mode");
}
