import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTFITS_FILE = path.join(__dirname, 'outfits.json');
const OUTFIT_PREVIEW_DIR = path.join(__dirname, '../generated_scripts/outfit_previews');
const SERVER_BASE = 'http://localhost:3002';
const PREVIEW_PREFIX = '/generated_scripts/outfit_previews/';

const normalizePreviewUrl = (filename) => `${SERVER_BASE}${PREVIEW_PREFIX}${filename}`;

const extractFilename = (url) => {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith(`${SERVER_BASE}${PREVIEW_PREFIX}`)) {
    return url.replace(`${SERVER_BASE}${PREVIEW_PREFIX}`, '');
  }
  if (url.startsWith(PREVIEW_PREFIX)) {
    return url.replace(PREVIEW_PREFIX, '');
  }
  return '';
};

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const listPreviewFiles = () => {
  if (!fs.existsSync(OUTFIT_PREVIEW_DIR)) return [];
  return fs.readdirSync(OUTFIT_PREVIEW_DIR).filter((name) => name.endsWith('.png'));
};

const findNewestByPrefix = (prefix, filenames) => {
  const candidates = filenames.filter((name) => name.startsWith(prefix));
  if (candidates.length === 0) return '';
  return candidates
    .map((name) => {
      const fullPath = path.join(OUTFIT_PREVIEW_DIR, name);
      const stat = fs.statSync(fullPath);
      return { name, time: stat.mtimeMs || 0 };
    })
    .sort((a, b) => b.time - a.time)[0]?.name || '';
};

const main = () => {
  if (!fs.existsSync(OUTFITS_FILE)) {
    console.error('[repair] outfits.json not found:', OUTFITS_FILE);
    process.exit(1);
  }

  const data = readJson(OUTFITS_FILE);
  const outfits = Array.isArray(data?.outfits) ? data.outfits : [];
  const previewFiles = listPreviewFiles();

  let fixedCount = 0;
  let missingCount = 0;

  const repaired = outfits.map((outfit) => {
    if (!outfit || !outfit.id) return outfit;

    const currentUrl = typeof outfit.imageUrl === 'string' ? outfit.imageUrl.trim() : '';
    if (currentUrl) {
      const filename = extractFilename(currentUrl);
      if (filename) {
        const fullPath = path.join(OUTFIT_PREVIEW_DIR, filename);
        if (fs.existsSync(fullPath)) {
          const normalized = normalizePreviewUrl(filename);
          if (normalized !== currentUrl) {
            fixedCount += 1;
            return { ...outfit, imageUrl: normalized };
          }
          return outfit;
        }
      }
    }

    const newest = findNewestByPrefix(`${outfit.id}_`, previewFiles);
    if (newest) {
      fixedCount += 1;
      return { ...outfit, imageUrl: normalizePreviewUrl(newest) };
    }

    missingCount += 1;
    return outfit;
  });

  const output = { ...data, outfits: repaired };
  fs.writeFileSync(OUTFITS_FILE, JSON.stringify(output, null, 2));

  console.log(`[repair] done. fixed=${fixedCount}, missing=${missingCount}`);
};

main();
