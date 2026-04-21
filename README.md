# Peak Wildlife Park Operations Field Map

Static HTML report for a Peak Wildlife Park operations interview. The page turns GPS metadata from the site-walk photos into an interactive evidence map with image pins.

## Open locally

For the one-file version, double-click:

```text
Peak-Wildlife-Park-Photo-Map.html
```

It contains the generated photos and map data. It still needs internet access for the map tiles and Leaflet CDN scripts.

For the editable project version:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Publish on GitHub Pages

1. Push this repository to GitHub.
2. In the repository, go to `Settings` -> `Pages`.
3. Set `Source` to `Deploy from a branch`.
4. Select the `main` branch and `/ (root)`.
5. Save. GitHub will publish the page after the first Pages build.

## Update the map from photos

The original source photos currently live outside this repo at `../Images`.

```bash
node scripts/build-photo-map-data.mjs ../Images
```

This regenerates:

- `data/photos.js`
- `assets/photos/*.jpg`
- `assets/thumbs/*.jpg`

Then regenerate the double-click standalone file:

```bash
node scripts/build-standalone-html.mjs
```

## Add observations

Keep manual notes in `data/observations.js` so they do not get overwritten when `data/photos.js` is regenerated.

Example:

```js
window.PEAK_OBSERVATIONS = {
  "IMG_5070": {
    title: "Main entrance signage",
    categories: ["signage", "arrival"],
    note: "Opportunity: clearer first-decision signage before guests reach the ticket point."
  }
};
```

The page uses Leaflet with OpenStreetMap and Esri tiles. Each popup also links the pinned point to Google Maps.
