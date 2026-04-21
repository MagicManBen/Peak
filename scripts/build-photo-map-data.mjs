#!/usr/bin/env node
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

const repoRoot = process.cwd();
const sourceDir = path.resolve(repoRoot, process.argv[2] ?? "../Images");
const sourceLabel = path.relative(repoRoot, sourceDir) || ".";
const dataDir = path.join(repoRoot, "data");
const photoDir = path.join(repoRoot, "assets", "photos");
const thumbDir = path.join(repoRoot, "assets", "thumbs");

const IMAGE_EXTENSIONS = new Set([".heic", ".heif", ".jpg", ".jpeg", ".png"]);

function parseRational(value) {
  const [top, bottom] = String(value).trim().split("/").map(Number);
  if (!Number.isFinite(top)) return null;
  if (!Number.isFinite(bottom) || bottom === 0) return top;
  return top / bottom;
}

function parseDms(value, ref) {
  if (!value) return null;
  const parts = value.split(",").map(parseRational);
  if (parts.length < 3 || parts.some((part) => part === null)) return null;

  let decimal = parts[0] + parts[1] / 60 + parts[2] / 3600;
  if (["S", "W"].includes(String(ref).trim().toUpperCase())) {
    decimal *= -1;
  }
  return Number(decimal.toFixed(8));
}

function safeBaseName(fileName) {
  return path.basename(fileName, path.extname(fileName)).replace(/[^a-z0-9_-]/gi, "-");
}

function toIsoDateTime(exifDate) {
  if (!exifDate) return null;
  const match = exifDate.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

async function imageMetadata(filePath) {
  const format = [
    "%[EXIF:GPSLatitude]",
    "%[EXIF:GPSLatitudeRef]",
    "%[EXIF:GPSLongitude]",
    "%[EXIF:GPSLongitudeRef]",
    "%[EXIF:DateTimeOriginal]",
    "%[EXIF:GPSImgDirection]",
    "%[EXIF:GPSDestBearing]",
    "%w",
    "%h",
  ].join("|");

  const { stdout } = await execFile("identify", ["-format", `${format}\n`, filePath], {
    maxBuffer: 1024 * 1024,
  });

  const [
    gpsLatitude,
    gpsLatitudeRef,
    gpsLongitude,
    gpsLongitudeRef,
    dateTimeOriginal,
    gpsImgDirection,
    gpsDestBearing,
    width,
    height,
  ] = stdout.trim().split("|");

  const lat = parseDms(gpsLatitude, gpsLatitudeRef);
  const lng = parseDms(gpsLongitude, gpsLongitudeRef);
  const direction = parseRational(gpsImgDirection || gpsDestBearing);

  return {
    lat,
    lng,
    shotAt: toIsoDateTime(dateTimeOriginal),
    direction: Number.isFinite(direction) ? Number(direction.toFixed(2)) : null,
    width: Number(width),
    height: Number(height),
  };
}

async function convertImage(inputPath, outputPath, resize, quality) {
  await execFile(
    "magick",
    [
      inputPath,
      "-auto-orient",
      "-strip",
      "-resize",
      resize,
      "-quality",
      String(quality),
      outputPath,
    ],
    { maxBuffer: 1024 * 1024 }
  );
}

async function main() {
  await mkdir(dataDir, { recursive: true });
  await mkdir(photoDir, { recursive: true });
  await mkdir(thumbDir, { recursive: true });

  const files = (await readdir(sourceDir))
    .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const photos = [];
  const skipped = [];

  for (const [index, fileName] of files.entries()) {
    const inputPath = path.join(sourceDir, fileName);
    const metadata = await imageMetadata(inputPath);

    if (metadata.lat === null || metadata.lng === null) {
      skipped.push(fileName);
      continue;
    }

    const id = safeBaseName(fileName);
    const photoOutput = `${id}.jpg`;
    const thumbOutput = `${id}.jpg`;

    await convertImage(inputPath, path.join(photoDir, photoOutput), "1400x1400>", 78);
    await convertImage(inputPath, path.join(thumbDir, thumbOutput), "420x420>", 72);

    photos.push({
      id,
      number: index + 1,
      title: id.replace(/-/g, " "),
      originalName: fileName,
      lat: metadata.lat,
      lng: metadata.lng,
      shotAt: metadata.shotAt,
      direction: metadata.direction,
      width: metadata.width,
      height: metadata.height,
      photo: `assets/photos/${photoOutput}`,
      thumb: `assets/thumbs/${thumbOutput}`,
      categories: [],
      note: "",
    });

    process.stdout.write(`Processed ${photos.length}/${files.length}: ${fileName}\n`);
  }

  photos.sort((a, b) => {
    if (a.shotAt && b.shotAt) return a.shotAt.localeCompare(b.shotAt);
    if (a.shotAt) return -1;
    if (b.shotAt) return 1;
    return a.originalName.localeCompare(b.originalName, undefined, { numeric: true });
  });

  const generatedAt = new Date().toISOString();
  const js = `window.PEAK_PHOTOS = ${JSON.stringify(photos, null, 2)};\nwindow.PEAK_PHOTO_META = ${JSON.stringify(
    {
      sourceDir: sourceLabel,
      generatedAt,
      totalSourceImages: files.length,
      totalMappedPhotos: photos.length,
      skipped,
    },
    null,
    2
  )};\n`;

  await writeFile(path.join(dataDir, "photos.js"), js);

  process.stdout.write(`\nGenerated ${photos.length} mapped photos in data/photos.js\n`);
  if (skipped.length > 0) {
    process.stdout.write(`Skipped ${skipped.length} images without GPS: ${skipped.join(", ")}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
