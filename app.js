const photos = (window.PEAK_PHOTOS ?? []).map((photo) => {
  const observation = window.PEAK_OBSERVATIONS?.[photo.id] ?? {};
  return {
    ...photo,
    ...observation,
    categories: [...(photo.categories ?? []), ...(observation.categories ?? [])],
    note: observation.note ?? photo.note ?? "",
  };
});

const focusAreas = window.PEAK_FOCUS_AREAS ?? [];
const meta = window.PEAK_PHOTO_META ?? {};

const state = {
  query: "",
  activeLens: null,
  routeVisible: true,
};

const elements = {
  count: document.querySelector("#stat-photo-count"),
  sourceCount: document.querySelector("#stat-source-count"),
  timeRange: document.querySelector("#stat-time-range"),
  search: document.querySelector("#photo-search"),
  list: document.querySelector("#photo-list"),
  lenses: document.querySelector("#lens-list"),
  activeLens: document.querySelector("#active-lens"),
  fitMap: document.querySelector("#fit-map"),
  toggleRoute: document.querySelector("#toggle-route"),
};

const formatTime = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

function photoLabel(photo) {
  return photo.title || photo.originalName || photo.id;
}

function formatShotAt(photo) {
  if (!photo.shotAt) return "Time not recorded";
  return formatTime.format(new Date(photo.shotAt));
}

function formatRange() {
  const dated = photos.filter((photo) => photo.shotAt);
  if (dated.length === 0) return "-";
  return `${formatShotAt(dated[0])}-${formatShotAt(dated[dated.length - 1])}`;
}

function matchesQuery(photo) {
  if (!state.query) return true;
  const haystack = [
    photo.id,
    photo.title,
    photo.originalName,
    photo.note,
    ...(photo.categories ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(state.query);
}

function googleMapsUrl(photo) {
  return `https://www.google.com/maps/search/?api=1&query=${photo.lat},${photo.lng}`;
}

function popupContent(photo) {
  const categories = photo.categories?.length
    ? `<p class="popup-card__tags">${photo.categories.join(" / ")}</p>`
    : "";
  const direction = photo.direction ? `<p>Bearing: ${photo.direction}&deg;</p>` : "";
  return `
    <article class="popup-card">
      <img src="${photo.photo}" alt="${photoLabel(photo)}" loading="lazy" />
      <div class="popup-card__body">
        <h3>${photoLabel(photo)}</h3>
        <p>${photo.originalName} · ${formatShotAt(photo)}</p>
        ${categories}
        ${photo.note ? `<p>${photo.note}</p>` : ""}
        ${direction}
        <a href="${googleMapsUrl(photo)}" target="_blank" rel="noreferrer">Open this point in Google Maps</a>
      </div>
    </article>
  `;
}

function createPhotoIcon(photo) {
  return L.divIcon({
    className: "photo-pin-wrap",
    html: `<div class="photo-pin"><img src="${photo.thumb}" alt="" /></div>`,
    iconSize: [52, 52],
    iconAnchor: [18, 52],
    popupAnchor: [8, -48],
  });
}

const map = L.map("map", {
  zoomControl: false,
  scrollWheelZoom: true,
});

L.control.zoom({ position: "bottomright" }).addTo(map);

const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 20,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
});

const satellite = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 20,
    attribution:
      "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  }
);

satellite.addTo(map);
L.control.layers({ Satellite: satellite, Street: street }, undefined, { position: "bottomleft" }).addTo(map);

const markers = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 46,
  iconCreateFunction(cluster) {
    return L.divIcon({
      className: "cluster-pin-wrap",
      html: `<div class="cluster-pin">${cluster.getChildCount()}</div>`,
      iconSize: [52, 52],
    });
  },
});

const markerById = new Map();

photos.forEach((photo) => {
  const marker = L.marker([photo.lat, photo.lng], { icon: createPhotoIcon(photo), title: photoLabel(photo) });
  marker.bindPopup(popupContent(photo), { maxWidth: 360 });
  markerById.set(photo.id, marker);
  markers.addLayer(marker);
});

map.addLayer(markers);

const route = L.polyline(
  photos.map((photo) => [photo.lat, photo.lng]),
  {
    color: "#d8a842",
    opacity: 0.88,
    weight: 3,
    dashArray: "10 9",
  }
).addTo(map);

function fitMap() {
  if (photos.length === 0) {
    map.setView([53.0313, -1.9309], 16);
    return;
  }
  map.fitBounds(L.latLngBounds(photos.map((photo) => [photo.lat, photo.lng])), {
    padding: [40, 40],
  });
}

function renderStats() {
  elements.count.textContent = photos.length.toString();
  elements.sourceCount.textContent = String(meta.totalSourceImages ?? photos.length);
  elements.timeRange.textContent = formatRange();
}

function renderLenses() {
  elements.lenses.innerHTML = focusAreas
    .map(
      (lens) =>
        `<button class="lens-button" type="button" data-lens="${lens.id}">${lens.label}</button>`
    )
    .join("");
}

function renderActiveLens() {
  const lens = focusAreas.find((item) => item.id === state.activeLens);
  elements.activeLens.textContent = lens
    ? lens.prompt
    : "Select a focus lens to frame the walk.";

  document.querySelectorAll(".lens-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.lens === state.activeLens);
  });
}

function renderList() {
  const visible = photos.filter(matchesQuery);
  elements.list.innerHTML = visible
    .map(
      (photo) => `
        <button class="photo-row" type="button" data-photo="${photo.id}">
          <img src="${photo.thumb}" alt="" loading="lazy" />
          <span>
            <strong>${photoLabel(photo)}</strong>
            <span>${formatShotAt(photo)} · ${photo.lat.toFixed(5)}, ${photo.lng.toFixed(5)}</span>
          </span>
        </button>
      `
    )
    .join("");

  if (visible.length === 0) {
    elements.list.innerHTML = `<p>No pinned photos match this search.</p>`;
  }
}

function focusPhoto(photoId) {
  const photo = photos.find((item) => item.id === photoId);
  const marker = markerById.get(photoId);
  if (!photo || !marker) return;

  map.setView([photo.lat, photo.lng], Math.max(map.getZoom(), 18), {
    animate: true,
  });
  markers.zoomToShowLayer(marker, () => marker.openPopup());
}

elements.search.addEventListener("input", (event) => {
  state.query = event.currentTarget.value.trim().toLowerCase();
  renderList();
});

elements.lenses.addEventListener("click", (event) => {
  const button = event.target.closest("[data-lens]");
  if (!button) return;
  state.activeLens = state.activeLens === button.dataset.lens ? null : button.dataset.lens;
  renderActiveLens();
});

elements.list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-photo]");
  if (!button) return;
  focusPhoto(button.dataset.photo);
});

elements.fitMap.addEventListener("click", fitMap);

elements.toggleRoute.addEventListener("click", () => {
  state.routeVisible = !state.routeVisible;
  if (state.routeVisible) {
    route.addTo(map);
  } else {
    route.remove();
  }
  elements.toggleRoute.textContent = state.routeVisible ? "Hide route" : "Show route";
  elements.toggleRoute.setAttribute("aria-pressed", String(state.routeVisible));
});

renderStats();
renderLenses();
renderActiveLens();
renderList();
fitMap();
