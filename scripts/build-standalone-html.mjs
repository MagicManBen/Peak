#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const repoRoot = process.cwd();
const outputFile = path.join(repoRoot, process.argv[2] ?? "Peak-Wildlife-Park-Photo-Map.html");

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function dataUri(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  const bytes = await readFile(filePath);
  return `data:${contentType(filePath)};base64,${bytes.toString("base64")}`;
}

async function main() {
  const [indexHtml, stylesCss, appJs, observationsJs, photosJs] = await Promise.all([
    readFile(path.join(repoRoot, "index.html"), "utf8"),
    readFile(path.join(repoRoot, "styles.css"), "utf8"),
    readFile(path.join(repoRoot, "app.js"), "utf8"),
    readFile(path.join(repoRoot, "data", "observations.js"), "utf8"),
    readFile(path.join(repoRoot, "data", "photos.js"), "utf8"),
  ]);

  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(photosJs, sandbox);

  const embeddedPhotos = [];
  for (const [index, photo] of sandbox.window.PEAK_PHOTOS.entries()) {
    process.stdout.write(`Embedding ${index + 1}/${sandbox.window.PEAK_PHOTOS.length}: ${photo.originalName}\n`);
    embeddedPhotos.push({
      ...photo,
      photo: await dataUri(photo.photo),
      thumb: await dataUri(photo.thumb),
    });
  }

  const embeddedPhotosJs = `window.PEAK_PHOTOS = ${JSON.stringify(embeddedPhotos)};\nwindow.PEAK_PHOTO_META = ${JSON.stringify({
    ...sandbox.window.PEAK_PHOTO_META,
    standaloneGeneratedAt: new Date().toISOString(),
  })};`;

  const standalone = indexHtml
    .replace(
      /<link rel="stylesheet" href="styles\.css" \/>/,
      `<style>\n${stylesCss.replace(/url\("assets\/thumbs\/IMG_5070\.jpg"\)/g, "none")}\n</style>`
    )
    .replace(
      /<script src="data\/photos\.js"><\/script>\s*<script src="data\/observations\.js"><\/script>\s*<script src="app\.js"><\/script>/,
      `<script>\n${embeddedPhotosJs}\n</script>\n<script>\n${observationsJs}\n</script>\n<script>\n${appJs}\n</script>`
    )
    .replace(
      /<title>Peak Wildlife Park Operations Field Map<\/title>/,
      "<title>Peak Wildlife Park Operations Field Map - Standalone</title>"
    )
    .replace(
      "notes later in <code>data/observations.js</code>.",
      "notes in the main project, then rebuild this standalone file."
    );

  await writeFile(outputFile, standalone);
  process.stdout.write(`\nWrote ${path.relative(repoRoot, outputFile)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
