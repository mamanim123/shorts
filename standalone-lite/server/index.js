import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { launchBrowser, closeBrowser, generateContent, generateSimpleText } from './puppeteerHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const parentRootDir = path.join(rootDir, '..');

// 로컬 .env 우선 로드, 없으면 부모 .env로 폴백
const localEnvResult = dotenv.config({ path: path.join(rootDir, '.env') });
if (localEnvResult.error) {
  dotenv.config({ path: path.join(parentRootDir, '.env') });
  console.log('[standalone-lite] .env not found locally, using parent .env');
} else {
  console.log('[standalone-lite] Loaded local .env');
}

const app = express();
const PORT = 3002;

const dataDir = path.join(rootDir, 'server', 'user_data');
const generatedDir = path.join(rootDir, 'generated_scripts');
const generatedImagesDir = path.join(generatedDir, 'images');
const generatedVideosDir = path.join(generatedDir, 'videos');
const generatedStoryDir = path.join(generatedDir, '대본폴더');
const outfitPreviewDir = path.join(generatedDir, 'outfit_previews');

const engineConfigFile = path.join(dataDir, 'engine_config.json');
const promptEnhancementFile = path.join(dataDir, 'prompt_enhancement_settings.json');
const outfitsFile = path.join(dataDir, 'outfits.json');
const outfitPreviewMapFile = path.join(dataDir, 'outfit_preview_map.json');
const imageHistoryFile = path.join(dataDir, 'image_history.json');
const appStorageFile = path.join(dataDir, 'app_storage.json');

const defaultEngineConfig = { prompts: {}, options: [] };
const defaultPromptEnhancementStore = {
  activeProfileId: 'profile-default',
  profiles: [
    {
      id: 'profile-default',
      name: '기본 옵션',
      settings: {
        autoEnhanceOnGeneration: true,
        slots: [
          {
            id: 'slot-nationality',
            label: '국적/민족성',
            keywords: ['South Korean style', 'Cheongdam-dong high society aura'],
            autoSentence: true,
            enabled: true,
          },
          {
            id: 'slot-figure',
            label: '체형/실루엣',
            keywords: ['Elegant hourglass silhouette', 'Well-proportioned feminine figure'],
            autoSentence: true,
            enabled: true,
          },
        ],
        useQualityTags: true,
        qualityTags: ', photorealistic, 8k resolution, cinematic lighting, masterpiece, professional photography, depth of field --ar 9:16',
        useGenderGuard: true,
      },
    },
  ],
};

const defaultOutfits = { outfits: [], categories: [] };
const defaultPreviewMap = { previews: {} };
const defaultImageHistory = { history: [] };
const defaultAppStorage = { storage: {} };

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const ensureFile = (filePath, fallback) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf8');
  }
};

const readJson = (filePath, fallback) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
};

const writeJson = (filePath, value) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
};

const extractValidJson = (text = '') => {
  const startCandidates = ['{', '['];
  for (let i = 0; i < text.length; i += 1) {
    if (!startCandidates.includes(text[i])) continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    const startChar = text[i];
    const endChar = startChar === '{' ? '}' : ']';
    for (let j = i; j < text.length; j += 1) {
      const ch = text[j];
      if (ch === '\\' && !escaped) {
        escaped = true;
        continue;
      }
      if (ch === '"' && !escaped) inString = !inString;
      escaped = false;
      if (inString) continue;
      if (ch === startChar) depth += 1;
      if (ch === endChar) depth -= 1;
      if (depth === 0) return text.slice(i, j + 1);
    }
  }
  return null;
};

const safeJsonParse = (text = '') => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const sanitizeName = (value = '') =>
  String(value)
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'item';

const decodeBase64Image = (imageData) => {
  if (typeof imageData !== 'string' || !imageData.trim()) {
    throw new Error('imageData is required');
  }

  const matched = imageData.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  const mimeType = matched?.[1] || 'image/png';
  const rawBase64 = matched?.[2] || imageData;
  const ext = mimeType.includes('jpeg') ? 'jpg' : mimeType.split('/')[1] || 'png';
  return { buffer: Buffer.from(rawBase64, 'base64'), ext };
};

const resolveGeneratedPath = (relativeFile) => {
  const normalized = String(relativeFile || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(generatedDir, normalized);
  if (!resolved.startsWith(path.resolve(generatedDir))) {
    throw new Error('Invalid file path');
  }
  return resolved;
};

const listStoryFolders = () => {
  if (!fs.existsSync(generatedStoryDir)) return [];
  return fs.readdirSync(generatedStoryDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const imageDir = path.join(generatedStoryDir, entry.name, 'images');
      const imageCount = fs.existsSync(imageDir)
        ? fs.readdirSync(imageDir).filter((name) => /\.(png|jpe?g|webp|gif)$/i.test(name)).length
        : 0;
      return { folderName: entry.name, imageCount };
    });
};

const readLatestStoryPayload = (storyId) => {
  const safeStoryId = sanitizeName(storyId || '');
  const storyDir = path.join(generatedStoryDir, safeStoryId);
  if (!fs.existsSync(storyDir)) return null;

  const storyJsonPath = path.join(storyDir, 'story.json');
  if (fs.existsSync(storyJsonPath)) {
    return readJson(storyJsonPath, null);
  }

  const jsonFiles = fs.readdirSync(storyDir)
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => fs.statSync(path.join(storyDir, b)).mtimeMs - fs.statSync(path.join(storyDir, a)).mtimeMs);

  if (jsonFiles.length === 0) return null;
  return readJson(path.join(storyDir, jsonFiles[0]), null);
};

ensureDir(dataDir);
ensureDir(generatedDir);
ensureDir(generatedImagesDir);
ensureDir(generatedVideosDir);
ensureDir(generatedStoryDir);
ensureDir(outfitPreviewDir);
ensureFile(engineConfigFile, defaultEngineConfig);
ensureFile(promptEnhancementFile, defaultPromptEnhancementStore);
ensureFile(outfitsFile, defaultOutfits);
ensureFile(outfitPreviewMapFile, defaultPreviewMap);
ensureFile(imageHistoryFile, defaultImageHistory);
ensureFile(appStorageFile, defaultAppStorage);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/generated_scripts', express.static(generatedDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/gemini-key', (_req, res) => {
  res.json({ key: process.env.GEMINI_API_KEY || process.env.API_KEY || '' });
});

app.get('/api/browser-status', (_req, res) => {
  res.json({ ok: true, mode: 'puppeteer-login-session' });
});

app.post('/api/browser/close', async (_req, res) => {
  try {
    await closeBrowser();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to close browser' });
  }
});

app.post('/api/generate', async (req, res) => {
  const { service, prompt, files, responseMode } = req.body || {};
  if (!service || !prompt) {
    res.status(400).json({ error: 'service and prompt are required' });
    return;
  }

  const tempFiles = [];
  if (Array.isArray(files)) {
    for (const fileData of files) {
      if (fileData?.base64) {
        try {
          const rawBase64 = String(fileData.base64);
          const base64Str = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
          const buffer = Buffer.from(base64Str, 'base64');
          const tempPath = path.join(rootDir, `temp_upload_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
          fs.writeFileSync(tempPath, buffer);
          tempFiles.push(tempPath);
        } catch (error) {
          console.error('[standalone-lite] Failed to process upload file:', error);
        }
      } else if (fileData?.path) {
        tempFiles.push(String(fileData.path));
      }
    }
  }

  try {
    console.log(`[standalone-lite] POST /api/generate 호출됨 (${service})`);
    const responseText = responseMode === 'simple-text'
      ? await generateSimpleText(String(service), String(prompt))
      : await generateContent(String(service), String(prompt), tempFiles);
    const extracted = extractValidJson(responseText || '');
    const parsed = extracted ? safeJsonParse(extracted) : safeJsonParse(responseText || '');
    if (parsed && typeof parsed === 'object') {
      res.json(parsed);
      return;
    }
    res.json({ rawResponse: responseText, text: responseText });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate content' });
  } finally {
    tempFiles.forEach((filePath) => {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    });
  }
});

app.get('/api/engine-config', (_req, res) => {
  res.json(readJson(engineConfigFile, defaultEngineConfig));
});

app.post('/api/engine-config', (req, res) => {
  const current = readJson(engineConfigFile, defaultEngineConfig);
  const next = {
    prompts: { ...(current.prompts || {}), ...(req.body?.prompts || {}) },
    options: Array.isArray(req.body?.options) ? req.body.options : current.options || [],
  };
  writeJson(engineConfigFile, next);
  res.json({ success: true, ...next });
});

app.get('/api/prompt-enhancement-settings', (_req, res) => {
  res.json(readJson(promptEnhancementFile, defaultPromptEnhancementStore));
});

app.get('/api/outfits', (_req, res) => {
  res.json(readJson(outfitsFile, defaultOutfits));
});

app.post('/api/outfits', (req, res) => {
  const payload = {
    outfits: Array.isArray(req.body?.outfits) ? req.body.outfits : [],
    categories: Array.isArray(req.body?.categories) ? req.body.categories : [],
  };
  writeJson(outfitsFile, payload);
  res.json({ success: true, ...payload });
});

app.get('/api/outfit-preview-map', (_req, res) => {
  res.json(readJson(outfitPreviewMapFile, defaultPreviewMap));
});

app.post('/api/outfit-preview-map', (req, res) => {
  const payload = { previews: req.body?.previews && typeof req.body.previews === 'object' ? req.body.previews : {} };
  writeJson(outfitPreviewMapFile, payload);
  res.json({ success: true, ...payload });
});

app.post('/api/save-outfit-preview', (req, res) => {
  try {
    const { imageData, outfitId, prompt } = req.body || {};
    const { buffer, ext } = decodeBase64Image(imageData);
    const safeOutfitId = sanitizeName(outfitId || 'outfit');
    const filename = `${safeOutfitId}_${Date.now()}.${ext}`;
    const filePath = path.join(outfitPreviewDir, filename);
    fs.writeFileSync(filePath, buffer);

    const current = readJson(outfitPreviewMapFile, defaultPreviewMap);
    current.previews = { ...(current.previews || {}), [safeOutfitId]: `/generated_scripts/outfit_previews/${filename}` };
    writeJson(outfitPreviewMapFile, current);

    res.json({ success: true, url: `/generated_scripts/outfit_previews/${filename}`, filename, prompt: prompt || '' });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to save outfit preview' });
  }
});

app.get('/api/image-history', (_req, res) => {
  res.json(readJson(imageHistoryFile, defaultImageHistory));
});

app.post('/api/image-history', (req, res) => {
  const payload = { history: Array.isArray(req.body?.history) ? req.body.history : [] };
  writeJson(imageHistoryFile, payload);
  res.json({ success: true });
});

app.get('/api/images/list', (_req, res) => {
  const files = fs.existsSync(generatedImagesDir)
    ? fs.readdirSync(generatedImagesDir).filter((name) => /\.(png|jpe?g|webp|gif)$/i.test(name))
    : [];
  res.json(files);
});

app.get(['/api/scripts/story-folders', '/api/images/story-folders'], (_req, res) => {
  res.json(listStoryFolders());
});

app.get('/api/story/:storyId', (req, res) => {
  const payload = readLatestStoryPayload(req.params.storyId);
  if (!payload) {
    res.status(404).json({ error: 'Story not found' });
    return;
  }
  res.json(payload);
});

app.post('/api/save-story', (req, res) => {
  try {
    const { title, content, scenes, storyId, folderName, scriptBody, metadata } = req.body || {};
    const safeStoryId = sanitizeName(folderName || storyId || title || 'untitled');
    const storyDir = path.join(generatedStoryDir, safeStoryId);
    ensureDir(storyDir);

    const normalizedScenes = Array.isArray(scenes)
      ? scenes.map((scene, index) => ({
          id: scene?.id || index + 1,
          scriptLine: scene?.scriptLine || scene?.text || '',
          text: scene?.text || scene?.scriptLine || '',
          shortPrompt: scene?.shortPrompt || '',
          longPrompt: scene?.longPrompt || '',
          imageUrl: scene?.imageUrl || '',
          assignedCharacter: scene?.assignedCharacter || null,
        }))
      : [];

    const finalScriptBody = typeof scriptBody === 'string' && scriptBody.trim()
      ? scriptBody
      : normalizedScenes.map((scene) => scene.scriptLine).filter(Boolean).join('\n');

    const payload = {
      title: title || safeStoryId,
      folderName: safeStoryId,
      scriptBody: finalScriptBody,
      content: typeof content === 'string' ? content : finalScriptBody,
      scenes: normalizedScenes,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      updatedAt: new Date().toISOString(),
    };

    writeJson(path.join(storyDir, 'story.json'), payload);
    fs.writeFileSync(path.join(storyDir, 'script.txt'), finalScriptBody || payload.content || '', 'utf8');

    res.json({ success: true, folderName: safeStoryId });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to save story' });
  }
});

app.get('/api/images/by-story/:storyId', (req, res) => {
  const safeStoryId = sanitizeName(req.params.storyId || '');
  const imageDir = path.join(generatedStoryDir, safeStoryId, 'images');
  if (!fs.existsSync(imageDir)) {
    res.json([]);
    return;
  }
  const files = fs.readdirSync(imageDir)
    .filter((name) => /\.(png|jpe?g|webp|gif)$/i.test(name))
    .map((filename) => ({
      filename: `대본폴더/${safeStoryId}/images/${filename}`,
      prompt: filename,
      isUnifiedPath: true,
    }));
  res.json(files);
});

app.post('/api/save-image', (req, res) => {
  try {
    const { imageData, prompt, storyId, sceneNumber, storyTitle } = req.body || {};
    const { buffer, ext } = decodeBase64Image(imageData);
    const safeStoryId = sanitizeName(storyId || storyTitle || 'images');
    const baseName = sanitizeName(prompt || `image_${sceneNumber || 'item'}`);
    const filename = `${baseName}_${Date.now()}.${ext}`;

    let relativePath = `images/${filename}`;
    let targetDir = generatedImagesDir;

    if (safeStoryId && safeStoryId !== 'images') {
      targetDir = path.join(generatedStoryDir, safeStoryId, 'images');
      ensureDir(targetDir);
      relativePath = `대본폴더/${safeStoryId}/images/${filename}`;
    }

    const filePath = path.join(targetDir, filename);
    fs.writeFileSync(filePath, buffer);

    res.json({
      success: true,
      filename: relativePath,
      url: `/generated_scripts/${relativePath}`,
      storyId: safeStoryId || undefined,
      sceneNumber: typeof sceneNumber === 'number' ? sceneNumber : undefined,
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to save image' });
  }
});

// App Storage API
app.get('/api/app-storage', (req, res) => {
  try {
    const { key } = req.query;
    const data = readJson(appStorageFile, defaultAppStorage);
    if (key) {
      res.json({ value: data.storage?.[key] });
    } else {
      res.json(data);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to read storage' });
  }
});

app.post('/api/app-storage', (req, res) => {
  try {
    const { key, value, entries } = req.body || {};
    const data = readJson(appStorageFile, defaultAppStorage);
    if (!data.storage) data.storage = {};

    if (entries) {
      Object.assign(data.storage, entries);
    } else if (key) {
      data.storage[key] = value;
    }

    writeJson(appStorageFile, data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save storage' });
  }
});

app.delete('/api/app-storage', (req, res) => {
  try {
    const { key } = req.body || {};
    const data = readJson(appStorageFile, defaultAppStorage);
    if (key && data.storage) {
      delete data.storage[key];
      writeJson(appStorageFile, data);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete from storage' });
  }
});

app.post('/api/delete-file', (req, res) => {
  try {
    const filePath = resolveGeneratedPath(req.body?.filename || '');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to delete file' });
  }
});

// [신규 추가] 501 에러 해결: Gemini API를 이용한 라이트 대본 생성 로직
app.post('/api/generate/raw', async (req, res) => {
  console.log('[standalone-lite] POST /api/generate/raw 호출됨');
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다 (.env 파일 확인).' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });
    
    let rawResponse = '';
    if (response && response.candidates && response.candidates.length > 0) {
        rawResponse = response.candidates[0].content.parts[0].text;
    } else {
        rawResponse = response.text || '';
    }

    // JSON 텍스트 파싱을 위해 클라이언트에서 처리하도록 raw 문자열을 보냅니다.
    // 폴더 생성 로직은 일단 스킵하고 (Lite 버전), 프론트에서 렌더링되게 만듭니다.
    res.json({
      success: true,
      rawResponse: rawResponse,
      service: 'GEMINI',
      _folderName: `lite_story_${Date.now()}` // 가상의 폴더명 부여
    });
  } catch (error) {
    console.error('[standalone-lite] Gemini 생성 오류:', error);
    res.status(500).json({ error: 'Gemini 생성 중 오류 발생', details: error.message });
  }
});

// [신규 추가] 캐릭터 이미지 분석 (Vision AI)
app.post('/api/describe-character-full', async (req, res) => {
  console.log('[standalone-lite] POST /api/describe-character-full 호출됨');
  const { image } = req.body;
  
  if (!image) {
    return res.status(400).json({ error: 'image(base64) is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' });
  }

  try {
    const ai = new GoogleGenAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Base64 데이터에서 헤더 제거 (data:image/png;base64, 부분)
    const base64Str = image.includes(',') ? image.split(',')[1] : image;

    const prompt = `
      Analyze the person in this photo in extreme detail to establish a "Visual DNA" for consistent AI generation.
      You must return ONLY a JSON object. No markdown, no conversational text.
      
      The JSON fields must be exactly:
      {
        "gender": "string (여성 or 남성)",
        "age": "string (approximate age, e.g., 20대)",
        "hairStyle": "string (detailed hair style description in English)",
        "hairColor": "string (detailed hair color in English)",
        "faceType": "string (face shape description in English)",
        "eyeColor": "string (eye color in English)",
        "bodyType": "string (body build/silhouette description in English)",
        "uniqueFeatures": "string (any distinguishing marks, glasses, etc. in English)",
        "outfitStyle": "string (current outfit description in English)",
        "style": "string (a combined comprehensive descriptive prompt for stable diffusion generation in English)"
      }
    `;

    const imageParts = [
      {
        inlineData: {
          data: base64Str,
          mimeType: 'image/png' // MIME 타입은 데이터에 따라 다를 수 있지만 일단 png로 통칭
        }
      }
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();
    
    // JSON 추출
    const extracted = extractValidJson(text);
    const parsed = extracted ? safeJsonParse(extracted) : safeJsonParse(text);

    if (!parsed) {
      console.error('[standalone-lite] Vision analysis failed to return valid JSON:', text);
      return res.status(500).json({ error: '분석 결과가 유효한 JSON이 아닙니다.', raw: text });
    }

    res.json(parsed);
  } catch (error) {
    console.error('[standalone-lite] Vision analysis error:', error);
    res.status(500).json({ error: '이미지 분석 중 오류 발생', details: error.message });
  }
});

app.get('/api/usage-stats', (_req, res) => {
  res.json({});
});

app.post('/api/zinius-chat', (_req, res) => {
  res.status(501).json({ success: false, error: 'zinius-chat is not implemented in standalone-lite server yet.' });
});


// ── 캐릭터 라이브러리 저장/불러오기 API ──
const CHARACTERS_DIR = path.join(rootDir, 'characters');
if (!fs.existsSync(CHARACTERS_DIR)) {
  fs.mkdirSync(CHARACTERS_DIR, { recursive: true });
}

// 저장된 캐릭터 파일 목록 조회
app.get('/api/characters/list', (_req, res) => {
  try {
    const files = fs.readdirSync(CHARACTERS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(CHARACTERS_DIR, f));
        return { name: f, savedAt: stat.mtime.toISOString(), size: stat.size };
      })
      .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    res.json({ success: true, files });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 캐릭터 저장
app.post('/api/characters/save', (req, res) => {
  try {
    const { fileName, data } = req.body;
    if (!fileName || !data) return res.status(400).json({ success: false, error: '파일명과 데이터가 필요합니다.' });
    const safeName = fileName.replace(/[^a-zA-Z0-9가-힣_\-]/g, '_');
    const filePath = path.join(CHARACTERS_DIR, `${safeName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    res.json({ success: true, fileName: `${safeName}.json`, path: filePath });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 캐릭터 불러오기
app.get('/api/characters/load/:fileName', (req, res) => {
  try {
    const safeName = req.params.fileName.replace(/[^a-zA-Z0-9가-힣_\-\.]/g, '_');
    const filePath = path.join(CHARACTERS_DIR, safeName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: '파일을 찾을 수 없습니다.' });
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json({ success: true, data });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 캐릭터 삭제
app.delete('/api/characters/delete/:fileName', (req, res) => {
  try {
    const safeName = req.params.fileName.replace(/[^a-zA-Z0-9가-힣_\-\.]/g, '_');
    const filePath = path.join(CHARACTERS_DIR, safeName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: '파일을 찾을 수 없습니다.' });
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.listen(PORT, async () => {
  console.log(`[standalone-lite] server listening on http://localhost:${PORT}`);
  const shouldAutoLaunchBrowser = process.env.PUPPETEER_AUTO_START === 'true';
  if (!shouldAutoLaunchBrowser) {
    console.log('[standalone-lite] Puppeteer auto-start disabled. Set PUPPETEER_AUTO_START=true to enable.');
    return;
  }

  try {
    await launchBrowser();
    console.log('[standalone-lite] Puppeteer browser launched at startup');
  } catch (error) {
    console.error('[standalone-lite] Failed to auto-launch Puppeteer browser:', error);
  }
});
