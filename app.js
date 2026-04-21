const photos = (window.PEAK_PHOTOS ?? []).map((photo) => {
  const observation = window.PEAK_OBSERVATIONS?.[photo.id] ?? {};
  return {
    ...photo,
    ...observation,
    note: observation.note ?? photo.note ?? "",
  };
});

const photoCount = document.querySelector("#photo-count");
const fitButton = document.querySelector("#fit-map");

function photoLabel(photo) {
  return photo.title || photo.originalName || photo.id;
}

function formatShotAt(photo) {
  if (!photo.shotAt) return "Time not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(photo.shotAt));
}

function googleMapsUrl(photo) {
  return `https://www.google.com/maps/search/?api=1&query=${photo.lat},${photo.lng}`;
}

function popupContent(photo) {
  return `
    <article class="popup-card">
      <img src="${photo.photo}" alt="${photoLabel(photo)}" loading="lazy" />
      <div class="popup-card__body">
        <h2>${photoLabel(photo)}</h2>
        <p>${photo.originalName} · ${formatShotAt(photo)}</p>
        ${photo.note ? `<p>${photo.note}</p>` : ""}
        <a href="${googleMapsUrl(photo)}" target="_blank" rel="noreferrer">Open in Google Maps</a>
      </div>
    </article>
  `;
}

function createPhotoIcon(photo) {
  return L.divIcon({
    className: "photo-pin-wrap",
    html: `<div class="photo-pin"><img src="${photo.thumb}" alt="" /></div>`,
    iconSize: [54, 54],
    iconAnchor: [18, 54],
    popupAnchor: [9, -50],
  });
}

const map = L.map("map", {
  fadeAnimation: false,
  preferCanvas: true,
  zoomControl: false,
  scrollWheelZoom: true,
});

L.control.zoom({ position: "bottomright" }).addTo(map);

const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  keepBuffer: 6,
  maxZoom: 20,
  updateWhenIdle: false,
  updateWhenZooming: false,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

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
);

L.control.layers({ Map: street, Satellite: satellite }, undefined, { position: "bottomleft" }).addTo(map);

const markers = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 42,
  iconCreateFunction(cluster) {
    return L.divIcon({
      className: "cluster-pin-wrap",
      html: `<div class="cluster-pin">${cluster.getChildCount()}</div>`,
      iconSize: [54, 54],
    });
  },
});

photos.forEach((photo) => {
  const marker = L.marker([photo.lat, photo.lng], {
    icon: createPhotoIcon(photo),
    title: photoLabel(photo),
  });
  marker.bindPopup(popupContent(photo), { maxWidth: 380 });
  markers.addLayer(marker);
});

map.addLayer(markers);

function fitMap() {
  if (photos.length === 0) {
    map.setView([53.0612, -1.9239], 17);
    return;
  }

  map.fitBounds(L.latLngBounds(photos.map((photo) => [photo.lat, photo.lng])), {
    padding: [48, 48],
    maxZoom: 18,
  });
}

photoCount.textContent = `${photos.length} GPS photos`;
fitButton.addEventListener("click", fitMap);

function settleMap() {
  map.invalidateSize(false);
  fitMap();
}

fitMap();
[0, 100, 350, 900, 1800].forEach((delay) => {
  setTimeout(settleMap, delay);
});

window.addEventListener("load", settleMap);
window.addEventListener("resize", settleMap);
window.addEventListener("orientationchange", () => setTimeout(settleMap, 250));
