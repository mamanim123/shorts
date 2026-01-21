import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';
import crypto from 'crypto';
import sharp from 'sharp';
import multer from 'multer';


dotenv.config();
import { jsonrepair } from 'jsonrepair';
import {
    initBrowser,
    launchBrowser,
    launchScriptBrowser,
    launchImageBrowser,
    generateContent,
    switchService,
    switchScriptService,
    switchImageService,
    submitPromptOnly,
    submitPromptAndCaptureImage,
    generateVideoFX,
    closeAllBrowsers
} from './puppeteerHandler.js';
import { searchYouTube } from './youtubeSearchHandler.js';
import {
    buildCharacterMap,
    injectCharacterDetails,
    isFemaleFromCharacters,
    assignCharacterIdsIfMissing,
    applyFullEnhancement,
    getSettings,
    saveSettings,
    previewSlotSentence,
    getProfileStore,
    saveProfileStore
} from './promptEnhancer.js';

// 새로운 유틸리티 import
import logger from './logger.js';
import { ApiError, ErrorHandler, createSuccessResponse, createErrorResponse } from './errorHandler.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;
const HISTORY_FILE = path.join(__dirname, '../history.json');
const GENERATED_DIR = path.join(__dirname, '../generated_scripts');
const SCRIPTS_BASE_DIR = path.join(GENERATED_DIR, '대본폴더'); // 대본들을 모아둘 폴더
const LONGFORM_DIR = path.join(__dirname, '../longform_sessions');
const TEMPLATE_DIR = path.join(__dirname, '../style_templates');
const IMAGES_DIR = path.join(GENERATED_DIR, 'images');
const ENGINE_CONFIG_FILE = path.join(__dirname, '../engine_config.json');
const PROMPT_PRESETS_FILE = path.join(__dirname, './prompt_presets.json');
const GENRE_GUIDELINES_FILE = path.join(GENERATED_DIR, 'genre_guidelines.json');
const FAVORITES_FILE = path.join(__dirname, './cineboard_favorites.json');
const IMAGE_CAPTURE_MAX_ATTEMPTS = Number(process.env.IMAGE_CAPTURE_MAX_ATTEMPTS || 2);
const lastImageFingerprintsByStory = new Map();

const AUTO_LAUNCH_DELAY_MS = Number(process.env.PUPPETEER_AUTO_LAUNCH_DELAY_MS || 5000);
const AUTO_LAUNCH_MAX_ATTEMPTS = Number(process.env.PUPPETEER_AUTO_LAUNCH_MAX_ATTEMPTS || 3);
let autoLaunchAttempts = 0;
let browserLaunchPromise = null;
let lastBrowserLaunchError = null;
let lastBrowserLaunchSuccessAt = 0;

// Ensure directories exist
if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR);
if (!fs.existsSync(SCRIPTS_BASE_DIR)) fs.mkdirSync(SCRIPTS_BASE_DIR, { recursive: true }); // 대본폴더 생성
if (!fs.existsSync(LONGFORM_DIR)) fs.mkdirSync(LONGFORM_DIR);
if (!fs.existsSync(TEMPLATE_DIR)) fs.mkdirSync(TEMPLATE_DIR);
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
if (!fs.existsSync(ENGINE_CONFIG_FILE)) {
    fs.writeFileSync(ENGINE_CONFIG_FILE, JSON.stringify({ prompts: {}, options: [] }, null, 2));
}
if (!fs.existsSync(PROMPT_PRESETS_FILE)) {
    fs.writeFileSync(PROMPT_PRESETS_FILE, JSON.stringify({ presets: [] }, null, 2));
}
if (!fs.existsSync(FAVORITES_FILE)) {
    fs.writeFileSync(FAVORITES_FILE, JSON.stringify({ favorites: [] }, null, 2));
}

const readEngineConfig = () => {
    try {
        const raw = fs.readFileSync(ENGINE_CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            prompts: parsed.prompts || {},
            options: Array.isArray(parsed.options) ? parsed.options : []
        };
    } catch (e) {
        console.error("Failed to read engine config:", e);
        return { prompts: {}, options: [] };
    }
};

const writeEngineConfig = (config) => {
    try {
        fs.writeFileSync(ENGINE_CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (e) {
        console.error("Failed to write engine config:", e);
        return false;
    }
};

const readPromptPresets = () => {
    try {
        const raw = fs.readFileSync(PROMPT_PRESETS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.presets) ? parsed.presets : [];
    } catch (e) {
        console.error("Failed to read prompt presets:", e);
        return [];
    }
};

const writePromptPresets = (presets = []) => {
    try {
        const sanitized = presets.map((preset) => ({
            id: String(preset.id || '').trim(),
            name: String(preset.name || '이름 없는 프리셋').trim(),
            description: preset.description ? String(preset.description) : '',
            content: preset.content ? String(preset.content) : ''
        })).filter((preset) => preset.id && preset.content);
        fs.writeFileSync(PROMPT_PRESETS_FILE, JSON.stringify({ presets: sanitized }, null, 2));
        return sanitized;
    } catch (error) {
        console.error("Failed to write prompt presets:", error);
        return null;
    }
};

const ensurePromptPresetId = (requestedId) => {
    if (requestedId && requestedId.trim()) return requestedId.trim();
    return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const sanitizeFolderName = (value = '') => {
    if (!value || typeof value !== 'string') return '';
    return value
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_{2,}/g, '_')
        .slice(0, 120);
};

const ensureUniqueFolderName = (baseName) => {
    // [FIX] 타임스탬프 기반으로 고유성을 확보하므로 번호(-2, -3) 체계 대신 타임스탬프만 활용
    const now = new Date();
    const timestamp = now.getFullYear().toString().slice(-2) +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0') + '_' +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0');

    let candidate = `${timestamp}_${baseName || 'story'}`;

    // 만약 1분 이내에 동일 제목으로 또 생성되는 경우를 위해 밀리초 추가 fallback
    if (fs.existsSync(path.join(SCRIPTS_BASE_DIR, candidate))) {
        candidate = `${timestamp}${now.getSeconds().toString().padStart(2, '0')}_${baseName || 'story'}`;
    }

    return candidate;
};

const createStoryFolderFromTitle = (title) => {
    const sanitized = sanitizeFolderName(title) || 'Untitled';
    const uniqueName = ensureUniqueFolderName(sanitized);
    return ensureStoryImageDirectory(uniqueName);
};

const ensureStoryImageDirectory = (storyId, title = null) => {
    let folderName = '';

    if (storyId && typeof storyId === 'string' && storyId.trim()) {
        folderName = sanitizeFolderName(storyId);
    }

    if (!folderName && title && typeof title === 'string') {
        folderName = sanitizeFolderName(title);
    }

    if (!folderName) {
        folderName = 'orphaned';
    }

    const storyDir = path.join(SCRIPTS_BASE_DIR, folderName);
    const unifiedImagesDir = path.join(storyDir, 'images');
    const legacyImagesDir = path.join(IMAGES_DIR, folderName);

    // ✅ [하이브리드 로직]
    // 1. 기존 레거시 폴더에 이미 이미지가 있는 경우 -> 레거시 경로 유지
    // 2. 그 외의 경우 (새 프로젝트 포함) -> 통일된 새 경로 사용
    let targetImagesDir = unifiedImagesDir;
    let isLegacy = false;

    if (fs.existsSync(legacyImagesDir)) {
        const files = fs.readdirSync(legacyImagesDir).filter(f => /\.(png|jpg|jpeg)$/i.test(f));
        if (files.length > 0) {
            targetImagesDir = legacyImagesDir;
            isLegacy = true;
            console.log(`[Server] 📂 Legacy project detected for ${folderName}, using legacy path.`);
        }
    }

    if (!fs.existsSync(storyDir)) fs.mkdirSync(storyDir, { recursive: true });
    if (!fs.existsSync(targetImagesDir)) fs.mkdirSync(targetImagesDir, { recursive: true });

    console.log(`📁 Story folder ready: ${folderName} (images: ${path.relative(process.cwd(), targetImagesDir)})`);
    return { storyDir, imagesDir: targetImagesDir, legacyImagesDir, safeId: folderName, isLegacy };
};



const ensureStoryMediaDirectories = (storyId, title = null) => {
    const base = ensureStoryImageDirectory(storyId, title);
    const audioDir = path.join(base.storyDir, 'audio');
    const videoDir = path.join(base.storyDir, 'video');
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
    return { ...base, audioDir, videoDir };
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const synthesizeSpeechToWav = (text, { speed = 1, pitch = 0 } = {}) => {
    const sampleRate = 24000;
    const normalizedSpeed = clamp(speed, 0.5, 2);
    const normalizedPitch = clamp(pitch, -20, 20);
    const chars = [...text.normalize('NFKD')];
    const chunkDuration = Math.max(0.08, 0.12 / normalizedSpeed);
    const chunkSamples = Math.floor(sampleRate * chunkDuration);
    const silenceSamples = Math.floor(sampleRate * 0.015);
    const totalSamples = Math.max(1, chars.length) * (chunkSamples + silenceSamples);
    const pcmBuffer = Buffer.alloc(totalSamples * 2);

    let offset = 0;
    chars.forEach((char, charIndex) => {
        const code = char.codePointAt(0) || 32;
        const isVowel = /[aeiouAEIOU]/.test(char);
        const baseFreq = 180 + (code % 60) * 6 + normalizedPitch * 4 + (isVowel ? 60 : 0);
        const vibratoRate = 5 + (charIndex % 3);
        const vibratoDepth = 8 + normalizedPitch * 0.3;
        for (let i = 0; i < chunkSamples; i++) {
            const env = Math.sin(Math.PI * (i / chunkSamples));
            const t = i / sampleRate;
            const vibrato = Math.sin(2 * Math.PI * vibratoRate * t) * vibratoDepth;
            const freq = baseFreq + vibrato;
            const vowelBoost = isVowel ? Math.sin(Math.PI * t * normalizedSpeed) * 0.2 : 0;
            const consonantNoise = isVowel ? 0 : (Math.random() * 2 - 1) * 0.05;
            const sampleValue = (Math.sin(2 * Math.PI * freq * t) + vowelBoost + consonantNoise) * env * 0.45;
            const clamped = Math.max(-1, Math.min(1, sampleValue));
            pcmBuffer.writeInt16LE(Math.round(clamped * 0x7fff), offset);
            offset += 2;
        }
        for (let i = 0; i < silenceSamples; i++) {
            pcmBuffer.writeInt16LE(0, offset);
            offset += 2;
        }
    });

    const pcmData = pcmBuffer.subarray(0, offset);
    const wavHeader = Buffer.alloc(44);
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + pcmData.length, 4);
    wavHeader.write('WAVE', 8);
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16);
    wavHeader.writeUInt16LE(1, 20);
    wavHeader.writeUInt16LE(1, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(sampleRate * 2, 28);
    wavHeader.writeUInt16LE(2, 32);
    wavHeader.writeUInt16LE(16, 34);
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(pcmData.length, 40);

    return Buffer.concat([wavHeader, pcmData]);
};

const resolveStoryAssetPath = (relativePath) => {
    if (!relativePath || typeof relativePath !== 'string') {
        throw new Error('잘못된 파일 경로입니다.');
    }
    const clean = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const targetPath = path.join(SCRIPTS_BASE_DIR, clean);
    if (!targetPath.startsWith(SCRIPTS_BASE_DIR)) {
        throw new Error('허용되지 않은 경로입니다.');
    }
    if (!fs.existsSync(targetPath)) {
        throw new Error('파일을 찾지 못했습니다.');
    }
    return targetPath;
};

const listImageStoryFolders = () => {
    if (!fs.existsSync(IMAGES_DIR)) {
        return [];
    }
    return fs.readdirSync(IMAGES_DIR)
        .map((entry) => {
            try {
                const fullPath = path.join(IMAGES_DIR, entry);
                const stat = fs.statSync(fullPath);
                return {
                    folderName: entry,
                    isDirectory: stat.isDirectory(),
                    mtimeMs: stat.mtimeMs
                };
            } catch {
                return null;
            }
        })
        .filter((item) => item && item.isDirectory)
        .sort((a, b) => b.mtimeMs - a.mtimeMs) // 최신순 정렬
        .map((item) => ({
            folderName: item.folderName,
            mtimeMs: item.mtimeMs,
            imageCount: (() => {
                try {
                    return fs.readdirSync(path.join(IMAGES_DIR, item.folderName))
                        .filter(file => /(png|jpg|jpeg)$/i.test(file))
                        .length;
                } catch {
                    return 0;
                }
            })()
        }));
};
const listScriptStoryFolders = () => {
    if (!fs.existsSync(SCRIPTS_BASE_DIR)) {
        return [];
    }
    return fs.readdirSync(SCRIPTS_BASE_DIR)
        .map((entry) => {
            try {
                const fullPath = path.join(SCRIPTS_BASE_DIR, entry);
                const stat = fs.statSync(fullPath);
                return {
                    folderName: entry,
                    isDirectory: stat.isDirectory(),
                    mtimeMs: stat.mtimeMs
                };
            } catch {
                return null;
            }
        })
        .filter((item) => item && item.isDirectory)
        .sort((a, b) => b.mtimeMs - a.mtimeMs) // 최신순 정렬
        .map((item) => {
            const folderName = item.folderName;
            // ✅ 하이브리드 카운팅: 기존 경로 + 새 경로 이미지 모두 합산
            const unifiedImagesPath = path.join(SCRIPTS_BASE_DIR, folderName, 'images');
            const legacyImagesPath = path.join(IMAGES_DIR, folderName);

            let count = 0;

            // 1. 새 구조 (대본폴더/{제목}/images/) 확인
            try {
                if (fs.existsSync(unifiedImagesPath)) {
                    count += fs.readdirSync(unifiedImagesPath)
                        .filter(file => /(png|jpg|jpeg)$/i.test(file))
                        .length;
                }
            } catch (e) { }

            // 2. 기존 구조 (images/{제목}/) 확인 (있을 경우에만 합산)
            try {
                if (fs.existsSync(legacyImagesPath)) {
                    count += fs.readdirSync(legacyImagesPath)
                        .filter(file => /(png|jpg|jpeg)$/i.test(file))
                        .length;
                }
            } catch (e) { }

            return {
                folderName,
                mtimeMs: item.mtimeMs,
                imageCount: count,
                scriptCount: (() => {
                    try {
                        return fs.readdirSync(path.join(SCRIPTS_BASE_DIR, folderName))
                            .filter(file => file.endsWith('.txt'))
                            .length;
                    } catch { return 0; }
                })()
            };
        });
};

const findPromptPreset = (id) => {
    if (!id) return null;
    return readPromptPresets().find(preset => preset.id === id) || null;
};

const mergePromptWithPreset = (prompt = "", presetId) => {
    if (!presetId) {
        return { finalPrompt: prompt, appliedPreset: null, error: null };
    }
    const preset = findPromptPreset(presetId);
    if (!preset) {
        return { finalPrompt: prompt, appliedPreset: null, error: `Prompt preset "${presetId}" not found.` };
    }
    const presetBlock = (preset.content || "").trim();
    if (!presetBlock) {
        return { finalPrompt: prompt, appliedPreset: preset, error: null };
    }
    const combined = [presetBlock, prompt || ""].filter(Boolean).join('\n\n').trim();
    return { finalPrompt: combined, appliedPreset: preset, error: null };
};

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use('/generated_scripts', express.static(GENERATED_DIR));
app.use('/generated_scripts/images', express.static(IMAGES_DIR));

const ensureBrowserReady = async (service) => {
    if (!browserLaunchPromise) {
        browserLaunchPromise = (async () => {
            try {
                if (service) {
                    await switchService(service);
                } else {
                    await launchBrowser();
                }
                lastBrowserLaunchError = null;
                lastBrowserLaunchSuccessAt = Date.now();
                return true;
            } catch (err) {
                lastBrowserLaunchError = err;
                throw err;
            } finally {
                browserLaunchPromise = null;
            }
        })();
    }
    return browserLaunchPromise;
};

const scheduleAutoLaunch = () => {
    if (process.env.PUPPETEER_AUTO_LAUNCH === 'false') {
        console.log("[Server] Puppeteer auto-launch disabled via env.");
        return;
    }
    if (autoLaunchAttempts >= AUTO_LAUNCH_MAX_ATTEMPTS) {
        console.warn("[Server] Puppeteer auto-launch attempt limit reached. Use /api/launch to start manually.");
        return;
    }
    setTimeout(async () => {
        autoLaunchAttempts += 1;
        console.log(`[Server] Auto-launching Puppeteer (attempt ${autoLaunchAttempts}/${AUTO_LAUNCH_MAX_ATTEMPTS})...`);
        try {
            await ensureBrowserReady();
            console.log("[Server] Puppeteer ready.");
            autoLaunchAttempts = AUTO_LAUNCH_MAX_ATTEMPTS; // Stop further retries
        } catch (err) {
            console.error(`[Server] Puppeteer auto-launch failed: ${err?.message || err}`);
            if (autoLaunchAttempts < AUTO_LAUNCH_MAX_ATTEMPTS) {
                scheduleAutoLaunch();
            } else {
                console.error("[Server] Auto-launch failed repeatedly. Launch manually from UI.");
            }
        }
    }, AUTO_LAUNCH_DELAY_MS);
};

scheduleAutoLaunch();

// Shutdown API
app.post('/api/shutdown', async (req, res) => {
    console.log("[Server] Shutdown requested. Cleaning up...");
    try {
        await closeAllBrowsers();
    } catch (e) {
        console.error("[Server] Cleanup failed during shutdown:", e);
    }
    res.json({ success: true, message: "Server shutting down, browsers closed." });
    setTimeout(() => process.exit(0), 1000);
});

// Browser Close API (Manual)
app.post('/api/browser/close', async (req, res) => {
    console.log("[Server] Manual browser close requested.");
    const success = await closeAllBrowsers();
    if (success) {
        res.json({ success: true, message: "All browsers closed successfully" });
    } else {
        res.status(500).json({ success: false, error: "Failed to close some browsers" });
    }
});

// 프로세스 종료 시 클린업 (예: Ctrl+C)
let isCleaningUp = false;
const cleanupAndExit = async (signal) => {
    if (isCleaningUp) return;
    isCleaningUp = true;
    console.log(`\n[Server] Received ${signal}. Cleaning up...`);
    try {
        await closeAllBrowsers();
    } catch (e) {
        console.error("[Server] Error during cleanup:", e);
    }
    process.exit(0);
};

['SIGINT', 'SIGTERM', 'SIGHUP', 'uncaughtException', 'unhandledRejection'].forEach(sig => {
    process.on(sig, (err) => {
        if (err && sig.includes('Exception')) console.error('[Server] Uncaught Exception:', err);
        if (err && sig.includes('Rejection')) console.error('[Server] Unhandled Rejection:', err);
        cleanupAndExit(sig);
    });
});

// --- System API ---
app.get('/api/auth/gemini-key', (req, res) => {
    const key = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
    res.json({ key });
});

app.post('/api/launch', async (req, res) => {
    const { service } = req.body;
    try {
        await ensureBrowserReady(service);
        res.json({ success: true, message: "Browser ready" });
    } catch (e) {
        console.error("Failed to launch browser:", e);
        res.status(500).json({
            error: "Failed to launch browser",
            details: e?.message || String(e)
        });
    }
});

// --- Script Generation API ---
app.post('/api/generate/raw', async (req, res) => {
    const { service, prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: "Prompt is required" });
    }

    const requestedService = typeof service === 'string' && SUPPORTED_PUPPETEER_SERVICES.has(service)
        ? service
        : 'GEMINI';

    try {
        console.log(`[Server] Generating content via ${requestedService}...`);
        await ensureBrowserReady(requestedService);

        const rawResponse = await generateContent(requestedService, prompt);
        console.log(`[Server] ✅ Content generated (${rawResponse?.length || 0} chars)`);

        // [NEW] 폴더 생성 로직 추가 - 고출력/씨네보드 불러오기 호환 및 오류 복구력 강화
        let folderName = null;
        let parsedData = null;
        let title = null;

        try {
            // [전략 1] extractValidJson 사용 (가장 안정적)
            const extracted = extractValidJson(rawResponse);
            if (extracted) {
                parsedData = tryParse(extracted);
            }

            // [전략 2] 코드 블록 추출
            if (!parsedData) {
                const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
                let match;
                while ((match = codeBlockRegex.exec(rawResponse)) !== null) {
                    const candidate = tryParse(match[1]);
                    if (isValidStory(candidate)) {
                        parsedData = candidate;
                        break;
                    }
                }
            }

            // [전략 3] 전체 텍스트 수리 시도
            if (!parsedData) {
                parsedData = tryParse(rawResponse);
            }

            if (!parsedData || !isValidStory(parsedData)) {
                throw new Error('Valid story object could not be parsed');
            }

            // title 추출
            title = parsedData.title ||
                (parsedData.scripts && parsedData.scripts[0]?.title) ||
                (parsedData.scripts && Array.isArray(parsedData.scripts) ? parsedData.scripts[0]?.title : null);

            if (!title) throw new Error('Title not found in parsed data');

        } catch (parseErr) {
            console.warn(`[Server] ⚠️ Could not parse JSON for folder creation: ${parseErr.message}`);

            // [FALLBACK] 파싱 실패시 텍스트에서 정규식으로 제목이라도 추출 시도
            const titleRegex = /"title"\s*:\s*"([^"]+)"/i;
            const match = rawResponse.match(titleRegex);
            if (match && match[1]) {
                title = match[1];
                console.log(`[Server] 💡 Recovered title via regex from malformed JSON: ${title}`);
            } else {
                title = `무제대본_${new Date().getTime()}`;
            }
        }

        // 폴더 생성 (어떤 경우에도 title은 최소한 무제로 확보됨)
        try {
            const { safeId } = createStoryFolderFromTitle(title);
            folderName = safeId;
            console.log(`[Server] 📁 Story folder ensured: ${folderName}`);

            // 대본 파일 저장
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const safeTitleForFile = sanitizeFolderName(title).substring(0, 50) || 'untitled';
            const filename = `[${requestedService}] ${timestamp}_${safeTitleForFile}.txt`;

            const storyScriptPath = path.join(SCRIPTS_BASE_DIR, folderName, filename);
            fs.writeFileSync(storyScriptPath, rawResponse);
            console.log(`[Server] ✅ Script saved to folder: ${storyScriptPath}`);
        } catch (folderErr) {
            console.error(`[Server] ❌ Critical failure in folder/file creation:`, folderErr);
            // 최후의 수단으로 UUID 기반이라도 시도할 수 있으나, 위에서 createStoryFolderFromTitle이 실패할 확률은 낮음
        }

        res.json({
            success: true,
            rawResponse,
            service: requestedService,
            _folderName: folderName  // 씨네보드 불러오기 호환
        });
    } catch (e) {
        console.error("Failed to generate content:", e);
        res.status(500).json({
            error: "Failed to generate content",
            details: e?.message || String(e)
        });
    }
});

app.get('/api/browser-status', (req, res) => {
    res.json({
        launching: Boolean(browserLaunchPromise),
        lastError: lastBrowserLaunchError ? (lastBrowserLaunchError.message || String(lastBrowserLaunchError)) : null,
        lastSuccessAt: lastBrowserLaunchSuccessAt || null,
        autoLaunchAttempts,
        autoLaunchMaxAttempts: AUTO_LAUNCH_MAX_ATTEMPTS
    });
});

// --- History API ---
app.get('/api/history', (req, res) => {
    if (!fs.existsSync(HISTORY_FILE)) return res.json([]);
    try {
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        console.error("Failed to read history:", e);
        res.json([]);
    }
});

app.post('/api/history', (req, res) => {
    try {
        const newHistory = req.body;
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(newHistory, null, 2));
        res.json({ success: true });
    } catch (e) {
        console.error("Failed to save history:", e);
        res.status(500).json({ error: "Failed to save history" });
    }
});

// --- Genre Guidelines API ---
app.get('/api/genre-guidelines', (req, res) => {
    try {
        if (!fs.existsSync(GENRE_GUIDELINES_FILE)) {
            return res.json({ genres: [] });
        }
        const data = fs.readFileSync(GENRE_GUIDELINES_FILE, 'utf8');
        const parsed = JSON.parse(data);
        res.json({ genres: Array.isArray(parsed.genres) ? parsed.genres : [] });
    } catch (e) {
        console.error("Failed to read genre guidelines:", e);
        res.json({ genres: [] });
    }
});

app.post('/api/genre-guidelines', (req, res) => {
    try {
        const { genres } = req.body;
        if (!Array.isArray(genres)) {
            return res.status(400).json({ error: "Invalid genres data" });
        }
        // 유효한 장르만 필터링 (빈 이름 제거)
        const validGenres = genres.filter(g => g && g.id && (g.name || '').trim());
        fs.writeFileSync(GENRE_GUIDELINES_FILE, JSON.stringify({ genres: validGenres }, null, 2));
        res.json({ success: true, count: validGenres.length });
    } catch (e) {
        console.error("Failed to save genre guidelines:", e);
        res.status(500).json({ error: "Failed to save genre guidelines" });
    }
});

// --- Prompt Preset API ---
app.get('/api/prompt-presets', (req, res) => {
    try {
        const presets = readPromptPresets().map(({ id, name, description }) => ({
            id,
            name,
            description
        }));
        res.json(presets);
    } catch (e) {
        console.error("Failed to list prompt presets:", e);
        res.status(500).json({ error: "Failed to load prompt presets" });
    }
});

app.get('/api/prompt-presets/:id', (req, res) => {
    try {
        const preset = findPromptPreset(req.params.id);
        if (!preset) {
            return res.status(404).json({ error: "Prompt preset not found" });
        }
        res.json(preset);
    } catch (e) {
        console.error("Failed to load prompt preset:", e);
        res.status(500).json({ error: "Failed to load prompt preset" });
    }
});

app.post('/api/prompt-presets', (req, res) => {
    try {
        const { id, name, description, content } = req.body || {};
        if (!content || !content.trim()) {
            return res.status(400).json({ error: "Preset content is required" });
        }
        const presets = readPromptPresets();
        const presetId = ensurePromptPresetId(id);
        if (presets.some((p) => p.id === presetId)) {
            return res.status(400).json({ error: "Preset ID already exists" });
        }
        const newPreset = {
            id: presetId,
            name: (name || '새 프리셋').trim(),
            description: description ? String(description) : '',
            content: content
        };
        const updatedList = [...presets, newPreset];
        const saved = writePromptPresets(updatedList);
        if (!saved) return res.status(500).json({ error: "Failed to save preset" });
        res.json(newPreset);
    } catch (error) {
        console.error("Failed to create preset:", error);
        res.status(500).json({ error: "Failed to create preset" });
    }
});

app.put('/api/prompt-presets/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, content } = req.body || {};
        if (!content || !content.trim()) {
            return res.status(400).json({ error: "Preset content is required" });
        }
        const presets = readPromptPresets();
        const index = presets.findIndex((preset) => preset.id === id);
        if (index === -1) {
            return res.status(404).json({ error: "Preset not found" });
        }
        presets[index] = {
            ...presets[index],
            name: (name || presets[index].name || '이름 없는 프리셋').trim(),
            description: description !== undefined ? String(description) : presets[index].description,
            content
        };
        const saved = writePromptPresets(presets);
        if (!saved) return res.status(500).json({ error: "Failed to update preset" });
        res.json(presets[index]);
    } catch (error) {
        console.error("Failed to update preset:", error);
        res.status(500).json({ error: "Failed to update preset" });
    }
});

app.delete('/api/prompt-presets/:id', (req, res) => {
    try {
        const { id } = req.params;
        const presets = readPromptPresets();
        const filtered = presets.filter((preset) => preset.id !== id);
        if (filtered.length === presets.length) {
            return res.status(404).json({ error: "Preset not found" });
        }
        const saved = writePromptPresets(filtered);
        if (!saved) return res.status(500).json({ error: "Failed to delete preset" });
        res.json({ success: true });
    } catch (error) {
        console.error("Failed to delete preset:", error);
        res.status(500).json({ error: "Failed to delete preset" });
    }
});

// --- File Saving API ---
app.post('/api/create-story-folder', (req, res) => {
    try {
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: "Title is required" });

        const { safeId } = createStoryFolderFromTitle(title);
        console.log(`[Server] 📁 Explicit folder creation requested for: ${title} -> ${safeId}`);

        res.json({
            success: true,
            folderName: safeId
        });
    } catch (e) {
        console.error("Failed to create story folder:", e);
        res.status(500).json({ error: "Failed to create story folder" });
    }
});

app.post('/api/save-story', (req, res) => {
    try {
        const { title, content, service } = req.body;
        const safeTitle = (title || 'Untitled').replace(/[^a-z0-9가-힣\s]/gi, '').trim().substring(0, 50) || 'Untitled';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const servicePrefix = service ? `[${service}] ` : '';
        const filename = `${servicePrefix}${timestamp}_${safeTitle}.txt`;
        // ✅ [수정] 루트 폴더 저장은 제거하고 스토리 폴더에만 저장
        let folderName = req.body.folderName || null;
        if (!folderName) {
            try {
                // JSON 파싱 시도하여 _folderName 확인
                const jsonMatch = content.match(/=== RESULT JSON ===\s*([\s\S]*)/);
                if (jsonMatch && jsonMatch[1]) {
                    const jsonStr = jsonMatch[1].trim();
                    const parsed = tryParse(jsonStr); // tryParse 사용 (안전함)
                    folderName = parsed?.scripts?.[0]?._folderName || parsed?._folderName;
                }
            } catch (e) {
                console.warn("[Server] ⚠️ Failed to parse folderName from content:", e.message);
            }
        }

        // 폴더명이 없으면 제목 기반으로 생성
        if (!folderName) {
            const { safeId } = createStoryFolderFromTitle(title || 'Untitled');
            folderName = safeId;
        }

        const storyDir = path.join(SCRIPTS_BASE_DIR, folderName);
        if (!fs.existsSync(storyDir)) {
            fs.mkdirSync(storyDir, { recursive: true });
        }

        const filePath = path.join(storyDir, filename);
        fs.writeFileSync(filePath, content);
        console.log(`[Server] ✅ Script saved to story folder: ${filePath}`);

        res.json({ success: true, filename, folderName });
    } catch (e) {
        console.error("Failed to save file:", e);
        res.status(500).json({ error: "Failed to save file" });
    }
});

// --- Image Saving API ---
app.post('/api/save-image', async (req, res) => {
    try {
        const { imageData, prompt, storyId, sceneNumber, storyTitle } = req.body;
        if (!imageData) return res.status(400).json({ error: "Image data is required" });

        const { imagesDir, safeId, isLegacy } = ensureStoryImageDirectory(storyId, storyTitle);
        const safePrompt = (prompt || 'generated_image').replace(/[^a-z0-9가-힣\s]/gi, '').trim().substring(0, 30);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sceneLabel = typeof sceneNumber === 'number'
            ? `scene-${String(sceneNumber).padStart(2, '0')}`
            : 'scene';
        const filename = `${sceneLabel}_${timestamp}_${safePrompt || 'image'}.png`;
        const filePath = path.join(imagesDir, filename);
        const tempPath = filePath + '.temp.png';

        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // ⭐ PNG 메타데이터 임베드 (AI Studio 이미지도 프롬프트 저장)
        await sharp(imageBuffer)
            .png({
                compressionLevel: 6,
                text: {
                    'Prompt': prompt || '',
                    'SceneNumber': String(sceneNumber || ''),
                    'StoryId': safeId || '',
                    'Source': 'ai-studio',
                    'CreatedAt': new Date().toISOString(),
                    'Filename': filename || ''
                }
            })
            .toFile(tempPath);

        // 안전하게 임시 파일 → 최종 파일로 이동
        fs.renameSync(tempPath, filePath);

        // ✅ [NEW] prompts.json에 프롬프트 저장 (PNG 메타데이터 백업)
        try {
            const promptsJsonPath = path.join(imagesDir, 'prompts.json');
            let promptsData = {};
            if (fs.existsSync(promptsJsonPath)) {
                try {
                    promptsData = JSON.parse(fs.readFileSync(promptsJsonPath, 'utf-8'));
                } catch { promptsData = {}; }
            }
            promptsData[filename] = {
                prompt: prompt || '',
                sceneNumber: sceneNumber || null,
                service: 'ai-studio',
                createdAt: new Date().toISOString(),
                storyId: safeId || ''
            };
            fs.writeFileSync(promptsJsonPath, JSON.stringify(promptsData, null, 2));
            console.log(`[Server] ✅ Prompt saved to prompts.json: ${filename}`);
        } catch (jsonError) {
            console.warn(`[Server] ⚠️ Failed to save prompt to JSON:`, jsonError);
        }

        const url = isLegacy
            ? `/generated_scripts/images/${safeId}/${filename}`
            : `/generated_scripts/대본폴더/${safeId}/images/${filename}`;

        console.log(`[Server] Saved image with metadata for story ${safeId} -> ${filePath}`);
        res.json({
            success: true,
            filename: `${safeId}/${filename}`,
            url,
            path: filePath,
            storyId: safeId,
            sceneNumber,
            isLegacy
        });
    } catch (e) {
        console.error("Failed to save image:", e);
        res.status(500).json({ error: "Failed to save image" });
    }
});

app.get('/api/images/list', (req, res) => {
    try {
        if (!fs.existsSync(IMAGES_DIR)) return res.json([]);
        const files = fs.readdirSync(IMAGES_DIR)
            .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
            .sort((a, b) => fs.statSync(path.join(IMAGES_DIR, b)).mtimeMs - fs.statSync(path.join(IMAGES_DIR, a)).mtimeMs);
        res.json(files);
    } catch (e) {
        console.error("Failed to list images:", e);
        res.status(500).json([]);
    }
});

// ✅ NEW: Get images for a specific story
app.get('/api/images/by-story/:storyId', async (req, res) => {
    try {
        const { storyId } = req.params;
        if (!storyId) return res.status(400).json({ error: "Story ID is required" });

        // 이미지 파일이 있는지 확인하는 헬퍼 함수
        const hasImages = (dir) => {
            if (!fs.existsSync(dir)) return false;
            const files = fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg)$/i.test(f));
            return files.length > 0;
        };

        // ✅ [통일] 1순위: 새 경로 (대본폴더/{제목}/images/) - 이미지가 있을 때만
        const unifiedDir = path.join(SCRIPTS_BASE_DIR, storyId, 'images');
        const legacyDir = path.join(IMAGES_DIR, storyId);

        let storyDir;
        let isUnifiedPath;

        // 통일 경로에 이미지가 있으면 통일 경로 사용
        if (hasImages(unifiedDir)) {
            storyDir = unifiedDir;
            isUnifiedPath = true;
            console.log(`[Server] 📂 Using unified path for ${storyId}: ${storyDir}`);
        }
        // 기존 경로에 이미지가 있으면 기존 경로 사용 (하위 호환성)
        else if (hasImages(legacyDir)) {
            storyDir = legacyDir;
            isUnifiedPath = false;
            console.log(`[Server] 📂 Using legacy path for ${storyId}: ${storyDir}`);
        }
        // 둘 다 이미지 없으면 빈 배열 반환
        else {
            return res.json([]);
        }

        // ✅ [NEW] prompts.json에서 프롬프트 로드 (우선순위 1)
        let promptsFromJson = {};
        const promptsJsonPath = path.join(storyDir, 'prompts.json');
        if (fs.existsSync(promptsJsonPath)) {
            try {
                promptsFromJson = JSON.parse(fs.readFileSync(promptsJsonPath, 'utf-8'));
                console.log(`[Server] ✅ Loaded prompts.json for story ${storyId}`);
            } catch (e) {
                console.warn(`[Server] ⚠️ Failed to parse prompts.json:`, e.message);
            }
        }

        // Read and sort images by modification time (newest first)
        const imageFiles = fs.readdirSync(storyDir)
            .filter(f => /\.(png|jpg|jpeg)$/i.test(f) && !f.includes('.temp.'))
            .sort((a, b) => {
                const aPath = path.join(storyDir, a);
                const bPath = path.join(storyDir, b);
                return fs.statSync(bPath).mtimeMs - fs.statSync(aPath).mtimeMs;
            });

        // Read metadata from PNG files (with prompts.json fallback)
        const filesWithMetadata = await Promise.all(imageFiles.map(async filename => {
            const imagePath = path.join(storyDir, filename);
            let metadata = null;

            // ✅ 우선순위 1: prompts.json에서 읽기
            if (promptsFromJson[filename]) {
                const jsonData = promptsFromJson[filename];
                metadata = {
                    prompt: jsonData.prompt || null,
                    sceneNumber: jsonData.sceneNumber || null,
                    createdAt: jsonData.createdAt || null,
                    service: jsonData.service || null,
                    storyId: jsonData.storyId || null
                };
                console.log(`[Server] ✅ Prompt from JSON for ${filename}: ${metadata.prompt?.substring(0, 30)}...`);
            }

            // ✅ 우선순위 2: PNG 메타데이터에서 읽기 (prompts.json에 없을 때만)
            if (!metadata?.prompt) {
                try {
                    const imageMetadata = await sharp(imagePath).metadata();
                    const comments = imageMetadata.comments || [];
                    const textData = imageMetadata.text || {};

                    const findMetaValue = (key) => {
                        const comment = comments.find(c => c.keyword === key);
                        if (comment?.text) return comment.text;
                        return textData[key] || null;
                    };

                    const promptValue = findMetaValue('Prompt');
                    if (promptValue) {
                        metadata = {
                            prompt: promptValue,
                            sceneNumber: findMetaValue('SceneNumber') ? parseInt(findMetaValue('SceneNumber')) : null,
                            createdAt: findMetaValue('CreatedAt'),
                            service: findMetaValue('Service'),
                            storyId: findMetaValue('StoryId')
                        };
                        console.log(`[Server] ✅ Prompt from PNG for ${filename}: ${promptValue.substring(0, 30)}...`);
                    }
                } catch (err) {
                    console.warn(`[Server] ⚠️ Failed to read PNG metadata for ${filename}:`, err.message);
                }
            }

            // ✅ [수정] 경로에 따라 올바른 상대 경로 반환
            // 통일 경로: 대본폴더/{storyId}/images/{filename}
            // 기존 경로: images/{storyId}/{filename}  (클라이언트가 /generated_scripts/images/ prefix 붙임)
            const relativePath = isUnifiedPath
                ? `대본폴더/${storyId}/images/${filename}`
                : `${storyId}/${filename}`;  // 기존 호환성 유지

            const result = {
                filename: relativePath,
                prompt: metadata?.prompt || filename,
                sceneNumber: metadata?.sceneNumber || null,
                createdAt: metadata?.createdAt || null,
                service: metadata?.service || null,
                isUnifiedPath: isUnifiedPath  // 클라이언트가 URL 구성 시 참조
            };

            // ✅ [NEW] sceneNumber가 없는 경우 파일명에서 추출 시도 (예: scene-01_...)
            if (result.sceneNumber === null) {
                const sceneMatch = filename.match(/scene-(\d+)/i);
                if (sceneMatch) {
                    result.sceneNumber = parseInt(sceneMatch[1]);
                    console.log(`[Server] 💡 Extracted sceneNumber ${result.sceneNumber} from filename: ${filename}`);
                }
            }

            if (result.prompt === filename) {
                console.log(`[Server] ⚠️ No prompt found for ${filename}, using filename as fallback`);
            }
            return result;
        }));

        console.log(`[Server] ✅ Found ${filesWithMetadata.length} images for story ${storyId}`);
        res.json(filesWithMetadata);
    } catch (e) {
        console.error(`Failed to list images for story ${req.params.storyId}:`, e);
        res.status(500).json({ error: "Failed to list images" });
    }
});

// ✅ NEW: Get videos for a specific story
app.get('/api/video/by-story/:storyId', async (req, res) => {
    try {
        const { storyId } = req.params;
        if (!storyId) return res.status(400).json({ error: "Story ID is required" });

        const videoDir = path.join(SCRIPTS_BASE_DIR, storyId, 'video');
        if (!fs.existsSync(videoDir)) {
            return res.json([]);
        }

        const videoFiles = fs.readdirSync(videoDir)
            .filter(f => /\.mp4$/i.test(f))
            .map(filename => {
                const stat = fs.statSync(path.join(videoDir, filename));
                // 파일명에서 씬 번호 추출 (예: scene-01_... -> 1)
                const sceneMatch = filename.match(/scene-(\d+)/i);
                const sceneNumber = sceneMatch ? parseInt(sceneMatch[1], 10) : null;

                const relativePath = `대본폴더/${storyId}/video/${filename}`;

                return {
                    filename,
                    sceneNumber,
                    url: `/generated_scripts/${relativePath}`,
                    mtime: stat.mtime,
                    size: stat.size
                };
            })
            .sort((a, b) => b.mtime - a.mtime);

        res.json(videoFiles);
    } catch (error) {
        console.error('[Server] ❌ Failed to get videos:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/images/story-folders', (req, res) => {
    try {
        const folders = listImageStoryFolders();
        res.json(folders);
    } catch (e) {
        console.error("Failed to list story folders:", e);
        res.status(500).json({ error: "Failed to list story folders" });
    }
});

app.get('/api/scripts/story-folders', (req, res) => {
    try {
        const folders = listScriptStoryFolders();
        // ✅ [수정] 최신 폴더가 위로 오도록 확실하게 정렬
        res.json(folders.sort((a, b) => b.mtimeMs - a.mtimeMs));
    } catch (e) {
        console.error("Failed to list script story folders:", e);
        res.status(500).json({ error: "Failed to list script story folders" });
    }
});

// NEW: Get script file from a specific folder
app.get('/api/scripts/by-folder/:folderName', (req, res) => {
    let parsedScenes = null;
    try {
        const { folderName } = req.params;
        if (!folderName || typeof folderName !== 'string') {
            return res.status(400).json({ error: 'Folder name is required' });
        }

        const scriptDir = path.join(SCRIPTS_BASE_DIR, folderName);

        // Check if folder exists
        if (!fs.existsSync(scriptDir)) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        // Find script files (*.txt)
        let files = fs.readdirSync(scriptDir)
            .filter(f => f.endsWith('.txt') && !f.includes('.temp'));

        let bestResult = {
            scriptFile: null,
            scriptPath: null,
            content: '',
            parsedScenes: [],
            stats: null
        };

        const tryFile = (fPath, fName) => {
            try {
                const fContent = fs.readFileSync(fPath, 'utf8');
                const fStats = fs.statSync(fPath);
                let fParsedScenes = null;
                let fRawParsedData = null;

                // Try JSON parsing
                const jsonMatch = fContent.match(/===\s*RESULT JSON\s*===\s*([\s\S]*)/i);
                const jsonToParse = jsonMatch && jsonMatch[1] ? jsonMatch[1].trim() : fContent;
                fRawParsedData = tryParse(jsonToParse);

                if (fRawParsedData) {
                    const scriptObj = fRawParsedData.scripts?.[0] || fRawParsedData;
                    const scenesSource = scriptObj.scenes || fRawParsedData.scenes || (Array.isArray(fRawParsedData) ? fRawParsedData : null);

                    if (Array.isArray(scenesSource)) {
                        fParsedScenes = scenesSource.map((scene, idx) => ({
                            sceneNumber: scene.sceneNumber || idx + 1,
                            summary: scene.summary || scene.scriptLine || scene.text || `Scene ${idx + 1}`,
                            scriptLine: scene.scriptLine || scene.summary || scene.text || '',
                            camera: scene.camera || '',
                            shotType: scene.shotType || '',
                            shortPrompt: scene.shortPrompt || scene.prompt || scene.imagePrompt || '',
                            longPrompt: scene.longPrompt || scene.prompt || scene.imagePrompt || '',
                            shortPromptKo: scene.shortPromptKo || '',
                            longPromptKo: scene.longPromptKo || '',
                            videoPrompt: scene.videoPrompt || '',
                            age: scene.age || '',
                            outfit: scene.outfit || ''
                        }));
                    }
                }

                // Try fallback text parsing if JSON failed or returned nothing
                if (!fParsedScenes || fParsedScenes.length === 0) {
                    const fallback = parseScenePromptsFromScript(fContent);
                    if (fallback.length > 0) {
                        fParsedScenes = fallback;
                    }
                }

                return {
                    scriptFile: fName,
                    scriptPath: fPath,
                    content: fContent,
                    parsedScenes: fParsedScenes || [],
                    stats: fStats
                };
            } catch (e) {
                console.warn(`[Server] Failed to try file ${fName}:`, e.message);
                return null;
            }
        };

        if (files.length > 0) {
            // Sort by time descending to try newest first
            files.sort((a, b) => {
                const statA = fs.statSync(path.join(scriptDir, a));
                const statB = fs.statSync(path.join(scriptDir, b));
                return statB.mtimeMs - statA.mtimeMs;
            });

            for (const f of files) {
                const res = tryFile(path.join(scriptDir, f), f);
                if (res && res.parsedScenes.length > (bestResult.parsedScenes?.length || 0)) {
                    bestResult = res;
                    // If we found a good JSON/Text script with multiple scenes, we can stop
                    if (bestResult.parsedScenes.length > 3) break;
                }
            }
        }

        // If not found in current folder, try fallback search
        if (!bestResult.scriptPath) {
            console.log(`[Server] ⚠️ No script in folder ${folderName}, searching in generated_scripts and images...`);
            const allScriptsRoot = fs.readdirSync(GENERATED_DIR)
                .filter(f => f.endsWith('.txt') && !f.includes('.temp'));
            const allScriptsImages = fs.existsSync(IMAGES_DIR)
                ? fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith('.txt') && !f.includes('.temp'))
                : [];
            const allScripts = [...allScriptsRoot, ...allScriptsImages];

            // 정규화 및 비교를 위한 유틸리티
            const normalize = (s) => s.normalize('NFC').replace(/_/g, ' ').trim();
            const stripSuffix = (s) => s.replace(/-\d+$/, '');
            const targetName = normalize(stripSuffix(folderName));
            const extractTitleFromFile = (filename) => {
                const base = filename.replace(/\.txt$/i, '');
                const withoutService = base.replace(/^\[[^\]]+\]\s*/i, '');
                const withoutTimestamp = withoutService.replace(/^\d{4}-\d{2}-\d{2}T[0-9\-:]+Z?_?/, '');
                return withoutTimestamp || base;
            };

            const matchedFiles = allScripts.filter(f => {
                const title = extractTitleFromFile(f);
                const normalizedTitle = normalize(stripSuffix(title));
                const normalizedFile = normalize(f.replace(/\.txt$/i, ''));
                return normalizedTitle.includes(targetName)
                    || targetName.includes(normalizedTitle)
                    || normalizedFile.includes(targetName)
                    || targetName.includes(normalizedFile);
            });

            if (matchedFiles.length > 0) {
                // Try each matched file and pick the best one
                for (const f of matchedFiles) {
                    const fPath = allScriptsRoot.includes(f) ? path.join(GENERATED_DIR, f) : path.join(IMAGES_DIR, f);
                    const res = tryFile(fPath, f);
                    if (res && res.parsedScenes.length > (bestResult.parsedScenes?.length || 0)) {
                        bestResult = res;
                    }
                }

                if (bestResult.scriptPath) {
                    console.log(`[Server] 💡 Found fallback script: ${bestResult.scriptFile}`);
                    // Copy to source folder if missing
                    const scriptInFolderPath = path.join(scriptDir, bestResult.scriptFile);
                    if (!fs.existsSync(scriptInFolderPath)) {
                        try {
                            fs.copyFileSync(bestResult.scriptPath, scriptInFolderPath);
                            bestResult.scriptPath = scriptInFolderPath;
                        } catch (e) {
                            console.warn(`[Server] Failed to copy fallback script:`, e.message);
                        }
                    }
                }
            }
        }

        if (!bestResult.scriptPath) {
            return res.status(404).json({ error: 'No script file found for this folder' });
        }

        console.log(`[Server] ✅ Best script picked: ${bestResult.scriptFile} (Scenes: ${bestResult.parsedScenes.length})`);

        res.json({
            folderName,
            scriptFile: bestResult.scriptFile,
            content: bestResult.content,
            parsedScenes: bestResult.parsedScenes,
            createdAt: bestResult.stats?.mtime,
            size: bestResult.stats?.size
        });
    } catch (e) {
        console.error(`Failed to load script from folder ${req.params.folderName}:`, e);
        res.status(500).json({ error: 'Failed to load script file' });
    }
});

const SUPPORTED_PUPPETEER_SERVICES = new Set(['GEMINI', 'CHATGPT', 'CLAUDE', 'GENSPARK', 'VIDEOFX']);

app.post('/api/video/refine-prompt', async (req, res) => {
    const { script, visualPrompt, scriptLine, action, emotion, targetAge, characterSlot } = req.body || {};
    try {
        console.log(`[SmartVideo] Refining prompt based on script context...`);
        console.log(`[SmartVideo] Script Line (대사): ${scriptLine}`);

        // Visual Base 정제: 불필요한 이미지 세부 정보 제거
        let cleanVisualPrompt = visualPrompt || '';

        // 이미지 품질/스타일 키워드 제거
        cleanVisualPrompt = cleanVisualPrompt
            .replace(/unfiltered raw photograph,?\s*8k ultra photorealism/gi, '')
            .replace(/ultra detailed skin texture[^,]*,?/gi, '')
            .replace(/realistic soft skin,?\s*8k ultra-hd/gi, '')
            .replace(/no text,?\s*no captions,?\s*no typography/gi, '')
            .replace(/--ar\s*9:16/gi, '');

        // 금지 키워드 제거
        cleanVisualPrompt = cleanVisualPrompt
            .replace(/NOT cartoon,?\s*NOT anime,?\s*NOT 3D render,?\s*NOT CGI,?\s*NOT plastic skin,?\s*NOT mannequin,?\s*NOT doll-like,?\s*NOT airbrushed,?\s*NOT overly smooth skin,?\s*NOT uncanny valley,?\s*NOT artificial looking,?\s*NOT illustration,?\s*NOT painting,?\s*NOT drawing/gi, '')
            .trim();

        // ===== 새로운 프롬프트: VIDEO PROMPT + DIALOGUE 분리 =====
        const analysisPrompt = `
[TASK: VIDEO PROMPT + DIALOGUE SEPARATION]

You must create TWO separate outputs:
1. "videoPrompt": A cinematic scene description for AI video generation (NO dialogue text here)
2. "dialogue": Extract the EXACT spoken words from the Script Line

[INPUT DATA]
* Script Line (이것이 캐릭터가 말할 실제 대사입니다): "${scriptLine || ''}"
* Visual Base: ${cleanVisualPrompt}
* Core Action: ${action || 'N/A'}
* Emotion: ${emotion || 'N/A'}
* Target Age: ${targetAge || '40s'}
* Character Slot: ${characterSlot || '원샷'}

[OUTPUT RULES]
1. "videoPrompt" must describe:
   - Character appearance (age, Korean identity)
   - Action/movement (walking, standing, gesturing)
   - Camera movement (dolly in, static, pan)
   - Lighting/mood (cinematic, golden hour, etc.)
   - DO NOT include any dialogue or spoken words here

2. "dialogue" must contain:
   - ONLY the exact Korean words the character will speak
   - Extract from Script Line, or create natural dialogue if Script Line is a description
   - Keep it short and natural (1-2 sentences max)

[OUTPUT FORMAT - STRICT JSON ONLY]
{
  "videoPrompt": "시각적 장면 설명만 (대사 제외)",
  "dialogue": "캐릭터가 말할 실제 한국어 대사"
}

[EXAMPLES]

Example 1:
Script Line: "지영이랑 혜경이가 하얀 눈밭 위에서 눈부시게 서 있었지."
Output:
{
  "videoPrompt": "40s의 멋진 한국인 여성 두 명이 하얀 눈밭 위에 우아하게 서있다. 바람에 머리카락이 살랑인다. 카메라가 천천히 다가간다. 골든아워 역광 조명.",
  "dialogue": "지영이랑 혜경이가 하얀 눈밭 위에서 눈부시게 서 있었지."
}

Example 2:
Script Line: "그녀가 카페에 들어서며 미소를 짓는다"
Output:
{
  "videoPrompt": "40s의 멋진 한국인 여성이 세련된 카페 문을 열고 들어선다. 부드러운 미소를 띠며 주위를 둘러본다. 카메라가 정면에서 촬영. 따뜻한 실내 조명.",
  "dialogue": "여기 분위기 정말 좋다."
}

Now process the input and output ONLY valid JSON (no other text, no markdown):
`;

        const { generateSimpleText } = await import('./puppeteerHandler.js');
        const rawResponse = await Promise.race([
            generateSimpleText('GEMINI', analysisPrompt),
            new Promise((_, reject) => setTimeout(() => reject(new Error('비디오 프롬프트 생성 시간 초과')), 120000))
        ]);

        console.log(`[SmartVideo] Raw LLM Response: ${rawResponse.substring(0, 200)}...`);

        // JSON 파싱 시도
        let refinedPrompt = '';
        let dialogue = '';

        try {
            // 코드 블록 및 불필요한 텍스트 제거
            let cleanResponse = rawResponse
                .replace(/```json/gi, '')
                .replace(/```/g, '')
                .replace(/^[^{]*/, '')  // JSON 시작 전 텍스트 제거
                .replace(/[^}]*$/, '')  // JSON 끝 후 텍스트 제거
                .trim();

            // JSON 객체 추출 시도
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanResponse = jsonMatch[0];
            }

            const parsed = JSON.parse(cleanResponse);

            refinedPrompt = parsed.videoPrompt || '';
            dialogue = parsed.dialogue || scriptLine || '';

            console.log(`[SmartVideo] ✅ Parsed successfully!`);
            console.log(`[SmartVideo] Video Prompt: ${refinedPrompt.substring(0, 100)}...`);
            console.log(`[SmartVideo] Dialogue: ${dialogue}`);

        } catch (parseError) {
            console.warn(`[SmartVideo] ⚠️ JSON 파싱 실패, 기존 방식으로 폴백:`, parseError.message);

            // 파싱 실패시: 기존 응답을 videoPrompt로, scriptLine을 dialogue로
            refinedPrompt = rawResponse
                .replace(/```(json)?/g, '')
                .replace(/```/g, '')
                .replace(/^(Sure!|Okay|Here's?|Here is)[^.!?:\n]*[:!\n]\s*/i, '')
                .trim();

            dialogue = scriptLine || '';
        }

        // 응답 반환
        res.json({
            success: true,
            refinedPrompt: refinedPrompt,
            dialogue: dialogue
        });

    } catch (error) {
        console.error("[RefinePrompt] Failed:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to refine prompt" });
    }
});

// [REMOVED DUPLICATE ENDPOINT]
app.post('/api/video/generate-smart-OLD-BROKEN', async (req, res) => {
    const { refinedPrompt, storyId, storyTitle, sceneNumber, imageUrl } = req.body || {};

    if (!refinedPrompt) {
        return res.status(400).json({ error: "Refined prompt is required" });
    }

    try {
        console.log(`[SmartVideo] Generating video for scene ${sceneNumber ?? '?'} using prompt: ${refinedPrompt}`);

        // 2. VideoFX(Veo) 연동하여 비디오 생성
        const { generateVideoFX } = await import('./puppeteerHandler.js');
        const videoData = await generateVideoFX(refinedPrompt, imageUrl);

        // 3. 비디오 저장 로직
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `scene-${String(sceneNumber || 0).padStart(2, '0')}_${timestamp}.mp4`;

        const mediaDirs = ensureStoryMediaDirectories(storyId, storyTitle);
        const targetDir = mediaDirs.videoDir;
        const filePath = path.join(targetDir, filename);

        const base64Data = videoData.replace(/^data:video\/\w+;base64,/, "");
        fs.writeFileSync(filePath, base64Data, 'base64');

        const relativePath = `${mediaDirs.safeId}/video/${filename}`;
        console.log(`[SmartVideo] ✅ Video saved: ${filePath}`);

        res.json({
            success: true,
            url: `/generated_scripts/${relativePath}`,
            filename: relativePath
        });

    } catch (error) {
        console.error("[SmartVideo] Failed:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate smart video" });
    }
});

app.post('/api/image/ai-generate', async (req, res) => {
    const { prompt, service, storyId, sceneNumber, autoCapture, title } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: "Prompt is required" });
    }

    const requestedService = typeof service === 'string' && SUPPORTED_PUPPETEER_SERVICES.has(service)
        ? service
        : 'GEMINI';

    try {
        console.log(`[ImageAI] Forwarding scene ${sceneNumber ?? '?'} from story ${storyId ?? 'unknown'} (title: ${title ?? 'N/A'}) to ${requestedService}`);
        await switchService(requestedService);

        if (autoCapture) {
            await switchImageService(requestedService);

            const { imagesDir, safeId, isLegacy } = ensureStoryImageDirectory(storyId, title);
            const sceneLabel = typeof sceneNumber === 'number'
                ? `scene-${String(sceneNumber).padStart(2, '0')}`
                : 'scene';

            let captureSummary = null;
            let captureError = null;

            for (let attempt = 1; attempt <= IMAGE_CAPTURE_MAX_ATTEMPTS; attempt++) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `${sceneLabel}_${timestamp}.png`;
                const targetPath = path.join(imagesDir, filename);
                const requestToken = `#${sceneLabel}-${crypto.randomUUID()}`;

                try {
                    const captureResult = await submitPromptAndCaptureImage(
                        requestedService,
                        prompt,
                        targetPath,
                        {
                            requestToken,
                            storyId: safeId,
                            sceneNumber,
                            attempt
                        }
                    );

                    const fingerprintKey = `${safeId}`;
                    const previousFingerprint = lastImageFingerprintsByStory.get(fingerprintKey);
                    if (previousFingerprint && previousFingerprint.hash === captureResult.hash) {
                        console.warn(`[ImageAI] Duplicate fingerprint detected for story ${safeId}.`);
                        if (fs.existsSync(targetPath)) {
                            try { fs.unlinkSync(targetPath); } catch (cleanupErr) {
                                console.warn(`[ImageAI] Failed to cleanup duplicate file ${targetPath}:`, cleanupErr);
                            }
                        }

                        if (attempt === IMAGE_CAPTURE_MAX_ATTEMPTS) {
                            throw new Error("다운로드된 이미지가 이전 씬과 동일합니다. 다시 시도해주세요.");
                        }
                        continue;
                    }

                    lastImageFingerprintsByStory.set(fingerprintKey, {
                        hash: captureResult.hash,
                        bytes: captureResult.bytes
                    });

                    captureSummary = { filename, targetPath, safeId, captureResult, isLegacy };
                    break;
                } catch (err) {
                    captureError = err;
                    if (fs.existsSync(targetPath)) {
                        try { fs.unlinkSync(targetPath); } catch (cleanupErr) {
                            console.warn(`[ImageAI] Cleanup after failure failed for ${targetPath}:`, cleanupErr);
                        }
                    }

                    if (attempt === IMAGE_CAPTURE_MAX_ATTEMPTS) {
                        throw err;
                    }
                    console.warn(`[ImageAI] Attempt ${attempt} failed. Retrying...`, err?.message || err);
                }
            }

            if (!captureSummary) {
                throw captureError || new Error("이미지 자동 캡처에 실패했습니다.");
            }

            const { filename, targetPath, safeId: normalizedId, captureResult, isLegacy: legacyFlag } = captureSummary;

            // ✅ Save metadata to PNG file using sharp
            try {
                const tempPath = `${targetPath}.temp.png`;
                await sharp(targetPath)
                    .png({
                        compressionLevel: 6,
                        text: {
                            'Prompt': prompt || '',
                            'SceneNumber': String(sceneNumber || ''),
                            'Service': requestedService || 'gemini',
                            'CreatedAt': new Date().toISOString(),
                            'StoryId': normalizedId || '',
                            'Filename': filename || ''
                        }
                    })
                    .toFile(tempPath);

                // Replace original with metadata-embedded version
                fs.unlinkSync(targetPath);
                fs.renameSync(tempPath, targetPath);
                console.log(`[ImageAI] ✅ PNG metadata embedded: ${filename}`);
            } catch (metaError) {
                console.warn(`[ImageAI] ⚠️ Failed to embed PNG metadata for ${filename}:`, metaError);
                // Continue even if metadata embedding fails
            }

            // ✅ [NEW] prompts.json에 프롬프트 저장 (PNG 메타데이터 백업)
            try {
                const promptsJsonPath = path.join(imagesDir, 'prompts.json');
                let promptsData = {};
                if (fs.existsSync(promptsJsonPath)) {
                    try {
                        promptsData = JSON.parse(fs.readFileSync(promptsJsonPath, 'utf-8'));
                    } catch { promptsData = {}; }
                }
                promptsData[filename] = {
                    prompt: prompt || '',
                    sceneNumber: sceneNumber || null,
                    service: requestedService || 'gemini',
                    createdAt: new Date().toISOString(),
                    storyId: normalizedId || ''
                };
                fs.writeFileSync(promptsJsonPath, JSON.stringify(promptsData, null, 2));
                console.log(`[ImageAI] ✅ Prompt saved to prompts.json: ${filename}`);
            } catch (jsonError) {
                console.warn(`[ImageAI] ⚠️ Failed to save prompt to JSON for ${filename}:`, jsonError);
            }

            const url = legacyFlag
                ? `/generated_scripts/images/${normalizedId}/${filename}`
                : `/generated_scripts/대본폴더/${normalizedId}/images/${filename}`;

            res.json({
                success: true,
                service: requestedService,
                storyId: normalizedId,
                imagePath: path.relative(process.cwd(), targetPath),
                url,
                filename,
                isLegacy: legacyFlag,
                bytes: captureResult.bytes,
                hash: captureResult.hash,
                responseId: captureResult.responseId,
                tokenMatched: captureResult.tokenMatched
            });
        } else {
            await submitPromptOnly(requestedService, prompt);
            res.json({
                success: true,
                service: requestedService,
                message: 'Prompt submitted to AI service'
            });
        }
    } catch (error) {
        console.error("[ImageAI] Failed to run AI image generation workflow:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to run AI generation" });
    }
});

// --- Video Saving API ---
app.post('/api/save-video', (req, res) => {
    try {
        const { videoData, prompt, storyId, storyTitle } = req.body || {};
        if (!videoData) return res.status(400).json({ error: "Video data is required" });

        const safePrompt = (prompt || 'generated_video').replace(/[^a-z0-9가-힣\s]/gi, '').trim().substring(0, 30) || 'video';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${timestamp}_${safePrompt}.mp4`;

        let targetDir = path.join(GENERATED_DIR, 'videos');
        let relativePrefix = 'videos';
        let resolvedStoryId = null;

        if (storyId || storyTitle) {
            const mediaDirs = ensureStoryMediaDirectories(storyId, storyTitle);
            targetDir = mediaDirs.videoDir;
            relativePrefix = `${mediaDirs.safeId}/video`;
            resolvedStoryId = mediaDirs.safeId;
        } else if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const filePath = path.join(targetDir, filename);
        const base64Data = videoData.replace(/^data:video\/\w+;base64,/, "");
        fs.writeFileSync(filePath, base64Data, 'base64');

        const relativePath = `${relativePrefix}/${filename}`;
        console.log(`[Server] Saved video to ${filePath}`);
        res.json({
            success: true,
            filename: relativePath,
            path: filePath,
            storyId: resolvedStoryId,
            url: `/generated_scripts/${relativePath}`
        });
    } catch (e) {
        console.error("Failed to save video:", e);
        res.status(500).json({ error: "Failed to save video" });
    }
});

// --- Generic File Deletion API ---
app.post('/api/delete-file', (req, res) => {
    try {
        const { filename, fileType } = req.body;
        if (!filename || typeof filename !== 'string') {
            return res.status(400).json({ error: "Filename is required" });
        }

        const baseDir = fileType === 'video' ? path.join(GENERATED_DIR, 'videos') : IMAGES_DIR;
        const normalizedPath = path.normalize(filename).replace(/^(\.\.[/\\])+/g, '');
        const filePath = path.resolve(baseDir, normalizedPath);

        if (!filePath.startsWith(path.resolve(baseDir))) {
            return res.status(400).json({ error: "Invalid filename path" });
        }

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[Server] Deleted file: ${filePath}`);

            if (fileType !== 'video') {
                const parentDir = path.dirname(filePath);
                if (parentDir.startsWith(path.resolve(IMAGES_DIR))) {
                    try {
                        const remaining = fs.readdirSync(parentDir).filter(name => !name.startsWith('.'));
                        if (remaining.length === 0) {
                            fs.rmdirSync(parentDir);
                            console.log(`[Server] Removed empty folder: ${parentDir}`);
                        }
                    } catch (cleanupError) {
                        console.warn(`Failed to cleanup folder ${parentDir}:`, cleanupError);
                    }
                }
            }

            res.json({ success: true });
        } else {
            res.status(404).json({ error: "File not found" });
        }
    } catch (e) {
        console.error("Failed to delete file:", e);
        res.status(500).json({ error: "Failed to delete file" });
    }
});

// --- Longform Session Saving API ---
app.post('/api/longform/save-session', (req, res) => {
    try {
        const { sessionId, data } = req.body;
        if (!sessionId || !data) return res.status(400).json({ error: "sessionId and data are required" });

        const sessionDir = path.join(LONGFORM_DIR, sessionId);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

        const filePath = path.join(sessionDir, 'chapters.json');
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        res.json({ success: true, path: filePath });
    } catch (e) {
        console.error("Failed to save longform session:", e);
        res.status(500).json({ error: "Failed to save longform session" });
    }
});

app.get('/api/longform/sessions', (req, res) => {
    try {
        if (!fs.existsSync(LONGFORM_DIR)) return res.json([]);
        const sessions = fs.readdirSync(LONGFORM_DIR)
            .filter(name => fs.existsSync(path.join(LONGFORM_DIR, name, 'chapters.json')))
            .map(name => {
                const file = path.join(LONGFORM_DIR, name, 'chapters.json');
                try {
                    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
                    return {
                        sessionId: name,
                        topic: data.topic || '제목 없음',
                        updatedAt: data.updatedAt || fs.statSync(file).mtimeMs
                    };
                } catch {
                    return { sessionId: name, topic: 'Unknown', updatedAt: fs.statSync(file).mtimeMs };
                }
            });
        res.json(sessions);
    } catch (e) {
        console.error("Failed to list sessions:", e);
        res.status(500).json({ error: "Failed to list sessions" });
    }
});

app.get('/api/longform/sessions/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const filePath = path.join(LONGFORM_DIR, sessionId, 'chapters.json');
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Session not found" });
        const data = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        console.error("Failed to load session:", e);
        res.status(500).json({ error: "Failed to load session" });
    }
});

// --- Style Templates API ---
app.get('/api/style-templates', (req, res) => {
    try {
        const files = fs.readdirSync(TEMPLATE_DIR).filter(f => f.endsWith('.json'));
        const templates = files.map(file => {
            const content = fs.readFileSync(path.join(TEMPLATE_DIR, file), 'utf8');
            return JSON.parse(content);
        });
        res.json(templates);
    } catch (e) {
        console.error("Failed to load templates:", e);
        res.status(500).json({ error: "Failed to load templates" });
    }
});

app.post('/api/style-templates', (req, res) => {
    try {
        const template = req.body;
        if (!template || !template.id) return res.status(400).json({ error: "Template must include id" });
        const filePath = path.join(TEMPLATE_DIR, `${template.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(template, null, 2));
        res.json({ success: true });
    } catch (e) {
        console.error("Failed to save template:", e);
        res.status(500).json({ error: "Failed to save template" });
    }
});

app.post('/api/style-templates/delete', (req, res) => {
    try {
        const { id } = req.body || {};
        if (!id) return res.status(400).json({ error: 'Template id required' });
        const filePath = path.join(TEMPLATE_DIR, `${id}.json`);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Template not found' });
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } catch (e) {
        console.error('Failed to delete template (POST):', e);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

app.delete('/api/style-templates/:id', (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'Template id required' });
        const filePath = path.join(TEMPLATE_DIR, `${id}.json`);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Template not found' });
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } catch (e) {
        console.error('Failed to delete template:', e);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

/**
 * Extracts the first valid JSON object from AI response text.
 * Handles cases where AI adds explanatory text after the JSON.
 */
/**
 * Extracts the first valid JSON object or array from AI response text.
 * Robustly handles cases where AI adds explanatory text around the JSON.
 * Improvement: Properly handles double-quoted strings to ignore braces inside them.
 */
const extractValidJson = (text = "") => {
    if (!text || typeof text !== 'string') return null;

    let depth = 0;
    let startIndex = -1;
    let inString = false;
    let escaped = false;
    let startChar = '';
    let endChar = '';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // 1. Handle string literal boundaries
        if (char === '"' && !escaped) {
            inString = !inString;
            continue;
        }

        // 2. Handle escape characters within strings
        if (inString) {
            if (char === '\\' && !escaped) {
                escaped = true;
            } else {
                escaped = false;
            }
            continue;
        }

        // 3. Handle structure outside of strings
        if (startIndex === -1) {
            if (char === '{' || char === '[') {
                startIndex = i;
                startChar = char;
                endChar = char === '{' ? '}' : ']';
                depth = 1;
            }
        } else {
            if (char === startChar) {
                depth++;
            } else if (char === endChar) {
                depth--;
                if (depth === 0) {
                    return text.substring(startIndex, i + 1);
                }
            }
        }
    }

    return null;
};

const stripCodeWrappers = (text = "") => {
    if (!text) return "";
    let cleaned = text.trim();
    // Remove common AI markers and markdown blocks
    cleaned = cleaned.replace(/^json\s*copy\s*code[:\-\s]*/i, '');
    cleaned = cleaned.replace(/^copy\s*code[:\-\s]*/i, '');
    cleaned = cleaned.replace(/```(?:json|txt|javascript|js)?/gi, '');
    cleaned = cleaned.replace(/```/g, '');
    cleaned = cleaned.replace(/^\s*Copy code.*$/gim, '');
    // Remove invisible characters or accidental prefixes like "Result:"
    cleaned = cleaned.replace(/^(Result|Output|JSON|Data):\s*/i, '');
    return cleaned.trim();
};

const escapeUnescapedNewlinesInStrings = (text = "") => {
    let result = '';
    let inString = false;
    let backslashCount = 0;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if ((char === '\n' || char === '\r') && inString) {
            if (char === '\r' && text[i + 1] === '\n') {
                result += '\\n';
                i++;
            } else {
                result += '\\n';
            }
            backslashCount = 0;
            continue;
        }

        result += char;

        if (char === '"') {
            if (backslashCount % 2 === 0) {
                inString = !inString;
            }
            backslashCount = 0;
            continue;
        }

        if (char === '\\') {
            backslashCount++;
        } else {
            backslashCount = 0;
        }
    }

    return result;
};

const preprocessJsonLikeString = (text = "") => {
    if (!text) return "";
    let cleaned = stripCodeWrappers(text);
    cleaned = escapeUnescapedNewlinesInStrings(cleaned);
    return cleaned;
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const escapeInlineQuotesForKeys = (text = "", keys = []) => {
    if (!text || keys.length === 0) return text;

    const keyPattern = keys.map(escapeRegex).join('|');
    const regex = new RegExp(`"(${keyPattern})"\\s*:\\s*"`, 'g');
    let result = '';
    let lastIndex = 0;

    while (true) {
        const match = regex.exec(text);
        if (!match) break;

        const valueStart = regex.lastIndex;
        result += text.slice(lastIndex, valueStart);

        let j = valueStart;
        let escaped = false;
        let chunk = '';

        while (j < text.length) {
            const ch = text[j];

            if (ch === '\\' && !escaped) {
                escaped = true;
                chunk += ch;
                j += 1;
                continue;
            }

            if (ch === '"' && !escaped) {
                let k = j + 1;
                while (k < text.length && /\s/.test(text[k])) k += 1;
                if (k >= text.length || /[,\]}]/.test(text[k])) {
                    break;
                }
                chunk += '\\"';
                j += 1;
                continue;
            }

            escaped = false;
            chunk += ch;
            j += 1;
        }

        result += chunk;
        if (j < text.length && text[j] === '"') {
            result += '"';
            j += 1;
        }

        lastIndex = j;
        regex.lastIndex = j;
    }

    result += text.slice(lastIndex);
    return result;
};

const tryParse = (str) => {
    if (!str) return null;

    const attempt = (value) => {
        if (!value) return null;
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    };

    // Pre-clean common issues
    let sanitized = stripCodeWrappers(str);

    // Step 0: Extract the actual JSON block (ignoring surrounding text/markdown)
    const extracted = extractValidJson(sanitized);
    if (extracted) {
        sanitized = extracted;
    }

    // Direct attempt
    const firstTry = attempt(sanitized);
    if (firstTry) return firstTry;

    console.log("[tryParse] Standard parse failed, applying complex sanitization...");

    try {
        // Fix common JSON formatting issues in AI responses
        let processed = sanitized
            .replace(/([가-힣\w\s])"([가-힣\w\s])/g, '$1\\"$2') // Unescaped quotes between words
            .replace(/([가-힣])"(\s*")/g, '$1\\"$2')              // Unescaped quote before closing quote
            .replace(/\n/g, '\\n')                                // Raw newlines
            .replace(/\r/g, '\\r');

        // Re-extract since balance might have changed (unlikely but safe)
        const reExtracted = extractValidJson(processed);
        const secondTry = attempt(reExtracted || processed);
        if (secondTry) return secondTry;

        // Step 1: Handle single quotes to double quotes mapping if needed
        if (processed.includes("'")) {
            const singleQuoteFixed = processed
                .replace(/{\s*'/g, '{ "')
                .replace(/'\s*:/g, '":')
                .replace(/:\s*'/g, ': "')
                .replace(/,\s*'/g, ', "')
                .replace(/'\s*,/g, '",')
                .replace(/'\s*}/g, '"}')
                .replace(/\[\s*'/g, '["')
                .replace(/'\s*\]/g, '"]');
            const thirdTry = attempt(singleQuoteFixed);
            if (thirdTry) return thirdTry;
        }
    } catch (e) {
        console.warn("[tryParse] Preprocessing error:", e.message);
    }

    // Final resort: jsonrepair
    try {
        console.log("[tryParse] Attempting jsonrepair...");
        const repaired = jsonrepair(sanitized);
        return JSON.parse(repaired);
    } catch (e) {
        console.error("[tryParse] All parsing strategies failed.");
        return null;
    }
};

const parseScenePromptsFromScript = (content) => {
    if (!content) return [];
    // Improve regex for section matching
    const sectionMatch = content.match(/===\s*(?:SCENES|IMAGE PROMPTS).*?===\s*([\s\S]*)/i);
    const section = sectionMatch ? sectionMatch[1] : content; // Try content directly if no section marker
    if (!section) return [];

    const fallbackParts = section.split(/\[Scene\s+(\d+)\]/gi);
    if (fallbackParts.length < 3) {
        // Try another split format if [Scene X] fails
        const alternativeParts = section.split(/Scene\s+(\d+)[:\.]/gi);
        if (alternativeParts.length >= 3) return parseParts(alternativeParts);
        return [];
    }
    return parseParts(fallbackParts);

    function parseParts(parts) {
        const scenes = [];
        for (let i = 1; i < parts.length; i += 2) {
            const sceneNumber = parseInt(parts[i], 10);
            if (!Number.isFinite(sceneNumber)) continue;
            const block = parts[i + 1] || '';
            const kr = (block.match(/^\s*(?:KR|Korean|국문|내용):\s*(.+)$/im) || [])[1];
            const en = (block.match(/^\s*(?:EN|English|영문|Prompt):\s*(.+)$/im) || [])[1];
            const long = (block.match(/^\s*(?:Long|Detail|상세):\s*(.+)$/im) || [])[1];

            scenes.push({
                sceneNumber,
                summary: `Scene ${sceneNumber}`,
                camera: '',
                shortPrompt: en ? en.trim() : '',
                shortPromptKo: kr ? kr.trim() : '',
                longPrompt: (long || en || '').trim(),
                longPromptKo: kr ? kr.trim() : ''
            });
        }
        return scenes;
    }
};

const isValidStory = (obj) => {
    if (!obj || typeof obj !== 'object') return false;

    // Support simple arrays (e.g., character lists)
    if (Array.isArray(obj)) {
        return obj.length > 0;
    }

    // Check if it's an object acting like an array (e.g., { '0': {...}, '1': {...} })
    const keys = Object.keys(obj);
    if (keys.length > 0 && keys.every(key => !isNaN(parseInt(key)))) {
        return true;
    }

    // Support scripts array format
    if (obj.scripts && Array.isArray(obj.scripts)) {
        return obj.scripts.length > 0 && obj.scripts[0].title;
    }

    // Single story format
    if (obj.title || obj.scriptBody || (obj.scenes && Array.isArray(obj.scenes))) return true;

    // Analysis/Character result format
    if (obj.characters && Array.isArray(obj.characters)) return true;
    if (obj.scores && (obj.totalScore !== undefined || obj.improvements)) return true;

    // Template format
    if (obj.templateName && obj.structure) return true;

    // For character notes enhancement mapping
    if (Object.keys(obj).length > 0 && !obj.title && !obj.scenes) return true;

    return false;
};

const pickDefaultMaleOutfit = (scriptText = "") => {
    const normalized = (scriptText || "").toLowerCase();
    const golfKeywords = /(골프|golf|라운딩|티박스)/;
    const officeKeywords = /(사무실|office|회사|미팅|거래|회의)/;
    if (golfKeywords.test(normalized)) return "White Performance Polo + Beige Chino Golf Pants";
    if (officeKeywords.test(normalized)) return "White Shirt + Navy Blazer + Grey Slacks";
    return "White Performance Polo + Beige Chino Golf Pants"; // 기본값
};

const ensureMaleConsistencyInScenes = (scenes = [], characterMap = {}, scriptText = "") => {
    if (!Array.isArray(scenes)) return scenes;
    const hasMaleCharacter = Object.values(characterMap).some((ch) => ch && String(ch.gender).toUpperCase() === 'MALE');
    const maleMentionInScript = /남자|남성|\bman\b|\bmen\b|male/iu.test(scriptText || "");
    const malePresent = hasMaleCharacter || maleMentionInScript;
    const defaultMaleOutfit = pickDefaultMaleOutfit(scriptText);

    return scenes.map((scene) => {
        if (!scene) return scene;
        let shortPrompt = scene.shortPrompt || "";
        let longPrompt = scene.longPrompt || "";

        if (malePresent) {
            // 남성이 있어야 하는 경우: No male 문구 제거
            shortPrompt = shortPrompt.replace(/No male characters appear[^\.]*\./gi, '').trim();
            longPrompt = longPrompt.replace(/No male characters appear[^\.]*\./gi, '').trim();

            const hasMaleInPrompt = /\bman\b|\bmen\b|male|남자|남성/iu.test(longPrompt);
            if (!hasMaleInPrompt) {
                longPrompt = longPrompt
                    ? `${longPrompt.replace(/\s+/g, ' ').trim()}, Korean man wearing ${defaultMaleOutfit} is present in this scene.`
                    : `Korean man wearing ${defaultMaleOutfit} is present in this scene.`;
            }
        } else {
            // 남성이 없어야 하는 경우: 명시적으로 제외
            if (longPrompt && !/No male characters appear/i.test(longPrompt)) {
                longPrompt = `${longPrompt.replace(/\s+/g, ' ').trim()}, No male characters appear in this scene.`;
            }
            if (shortPrompt && /No male characters appear/i.test(longPrompt) && !/No male characters appear/i.test(shortPrompt)) {
                shortPrompt = `${shortPrompt.replace(/\s+/g, ' ').trim()}, No male characters appear in this scene.`;
            }
        }

        return { ...scene, shortPrompt, longPrompt };
    });
};

// --- Chat API (Puppeteer Automation) ---
app.post('/api/generate', async (req, res) => {
    const { service, prompt, promptPresetId, files } = req.body;
    if (!service || !prompt) return res.status(400).json({ error: "Service and prompt are required" });

    // Handle temporary files for upload
    const tempFiles = [];
    if (files && Array.isArray(files)) {
        for (const fileData of files) {
            if (fileData.base64) {
                try {
                    const base64Str = fileData.base64.includes(',') ? fileData.base64.split(',')[1] : fileData.base64;
                    const buffer = Buffer.from(base64Str, 'base64');
                    const tempPath = path.join(process.cwd(), `temp_upload_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
                    fs.writeFileSync(tempPath, buffer);
                    tempFiles.push(tempPath);
                } catch (e) {
                    console.error("Failed to process base64 file:", e.message);
                }
            } else if (fileData.path) {
                tempFiles.push(fileData.path);
            }
        }
    }

    try {
        console.log(`[Server] Switching to ${service}...`);
        await switchService(service);

        console.log(`[Server] Sending prompt to ${service}...`);
        const { finalPrompt, appliedPreset, error: presetError } = mergePromptWithPreset(prompt, promptPresetId);
        if (presetError) {
            return res.status(400).json({ error: presetError });
        }
        if (appliedPreset) {
            console.log(`[Server] Applied prompt preset "${appliedPreset.name}" (${appliedPreset.id})`);
        }

        // [AUTO-SAVE] Save sent prompt to file
        try {
            fs.writeFileSync(path.join(process.cwd(), '보낸대본.txt'), finalPrompt, 'utf-8');
            console.log('[Server] ✅ Saved sent prompt to 보낸대본.txt');
        } catch (err) {
            console.error('[Server] ⚠️ Failed to save sent prompt:', err.message);
        }

        const responseText = await generateContent(service, finalPrompt, tempFiles);
        console.log("[Server] Raw Response:", responseText.substring(0, 100) + "...");

        // [AUTO-SAVE] Save received response to file
        try {
            fs.writeFileSync(path.join(process.cwd(), '받은대본.txt'), responseText, 'utf-8');
            console.log('[Server] ✅ Saved received response to 받은대본.txt');
        } catch (err) {
            console.error('[Server] ⚠️ Failed to save received response:', err.message);
        }

        let parsedData = null;

        // Strategy 0: Extract first valid JSON (handles AI adding text after JSON)
        if (!parsedData) {
            const extracted = extractValidJson(responseText);
            if (extracted) {
                const candidate = tryParse(extracted);
                if (isValidStory(candidate)) parsedData = candidate;
            }
        }

        // Strategy 1: Markdown code blocks
        if (!parsedData) {
            const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
            let match;
            while ((match = codeBlockRegex.exec(responseText)) !== null) {
                const candidate = tryParse(match[1]);
                if (isValidStory(candidate)) {
                    parsedData = candidate;
                    break;
                }
            }
        }

        // Strategy 2: Brace balancing
        if (!parsedData) {
            let braceStack = 0;
            let startIndex = -1;
            for (let i = 0; i < responseText.length; i++) {
                const char = responseText[i];
                if (char === '{') {
                    if (braceStack === 0) startIndex = i;
                    braceStack++;
                } else if (char === '}') {
                    braceStack--;
                    if (braceStack === 0 && startIndex !== -1) {
                        const jsonStr = responseText.substring(startIndex, i + 1);
                        const candidate = tryParse(jsonStr);
                        if (isValidStory(candidate)) {
                            parsedData = candidate;
                            break;
                        }
                        startIndex = -1;
                    }
                }
            }
        }

        // Strategy 3: Largest outer block
        if (!parsedData) {
            const firstOpen = responseText.indexOf('{');
            const lastClose = responseText.lastIndexOf('}');
            if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
                const candidate = tryParse(responseText.substring(firstOpen, lastClose + 1));
                if (isValidStory(candidate)) parsedData = candidate;
            }
        }

        // Strategy 4: Whole text repair
        if (!parsedData) {
            const candidate = tryParse(responseText);
            if (isValidStory(candidate)) parsedData = candidate;
        }

        if (!parsedData) {
            console.error("JSON Parse Error. Raw Response:", responseText);
            throw new Error("AI output is not valid JSON. Raw: " + responseText.substring(0, 100));
        }

        // [POST-PROCESSING]
        // Normalize scriptBody if AI returned an array
        if (parsedData.scriptBody && Array.isArray(parsedData.scriptBody)) {
            parsedData.scriptBody = parsedData.scriptBody.filter(Boolean).join('\n');
        } else if (parsedData.scriptBody && typeof parsedData.scriptBody !== 'string') {
            parsedData.scriptBody = String(parsedData.scriptBody);
        }

        // Normalize character IDs to strings to avoid type mismatch ("1" vs 1)
        if (Array.isArray(parsedData.characters)) {
            parsedData.characters = parsedData.characters.map((character, idx) => {
                if (!character) return character;
                const normalizedId = character.id !== undefined ? String(character.id) : String(idx + 1);
                return { ...character, id: normalizedId };
            });
        }

        const characterMap = buildCharacterMap(parsedData.characters || []);
        if (parsedData.scenes && Array.isArray(parsedData.scenes)) {
            parsedData.scenes = assignCharacterIdsIfMissing(parsedData.scenes, characterMap);

            parsedData.scenes = parsedData.scenes.map(scene => {
                if (!scene) return scene;
                if (Array.isArray(scene.characterIds)) {
                    scene = {
                        ...scene,
                        characterIds: scene.characterIds.map(id => String(id))
                    };
                }
                return scene;
            });

            // Check settings for automatic enhancement
            const settings = getSettings();

            parsedData.scenes = parsedData.scenes.map(scene => {
                // If auto-enhance is OFF, return original prompts
                if (!settings.autoEnhanceOnGeneration) {
                    return scene;
                }

                // Enhance prompts
                return {
                    ...scene,
                    shortPrompt: applyFullEnhancement(scene.shortPrompt, scene.characterIds, characterMap),
                    longPrompt: applyFullEnhancement(scene.longPrompt, scene.characterIds, characterMap),
                    imagePrompt: applyFullEnhancement(scene.imagePrompt, scene.characterIds, characterMap)
                };
            });

            // Align male presence with script/characters
            parsedData.scenes = ensureMaleConsistencyInScenes(parsedData.scenes, characterMap, parsedData.scriptBody || '');
        }

        if (hasScriptPayload(parsedData)) {
            const scriptsArray = (Array.isArray(parsedData.scripts) && parsedData.scripts.length > 0)
                ? parsedData.scripts
                : [(() => {
                    const { scripts, ...rest } = parsedData;
                    return rest;
                })()];

            const normalizedScripts = scriptsArray.map((script, idx) => {
                const baseTitle = script.title || parsedData.title || `대본 ${Date.now()}_${idx + 1}`;
                let folderName = script._folderName;
                if (!folderName) {
                    const { safeId } = createStoryFolderFromTitle(baseTitle);
                    console.log(`✅ Story folder created: ${safeId}`);
                    folderName = safeId;
                }
                return {
                    ...script,
                    title: script.title || baseTitle,
                    _folderName: folderName
                };
            });

            // Cleanup temp files
            for (const f of tempFiles) {
                try { fs.unlinkSync(f); } catch (e) { }
            }

            res.json({
                ...parsedData,
                scripts: normalizedScripts
            });
        } else {
            // Cleanup temp files
            for (const f of tempFiles) {
                try { fs.unlinkSync(f); } catch (e) { }
            }
            res.json(parsedData);
        }
    } catch (error) {
        console.error("[Server] Generation failed:", error);
        // Cleanup temp files
        for (const f of tempFiles) {
            try { fs.unlinkSync(f); } catch (e) { }
        }
        res.status(500).json({ error: error.message });
    }
});

function hasScriptPayload(obj) {
    return (
        (obj.scripts && Array.isArray(obj.scripts) && obj.scripts.length > 0) ||
        obj.title ||
        obj.scriptBody ||
        (obj.scenes && Array.isArray(obj.scenes))
    );
}

// [NEW] Manual Prompt Enhancement API
app.post('/api/enhance-prompt', (req, res) => {
    try {
        const { prompt, characterIds } = req.body;
        if (!prompt) return res.status(400).json({ error: "Prompt is required" });

        const enhancedPrompt = applyFullEnhancement(prompt, characterIds || [], {});
        res.json({ enhancedPrompt });
    } catch (e) {
        console.error("Enhancement failed:", e);
        res.status(500).json({ error: "Enhancement failed" });
    }
});

app.post('/api/prompt-enhancement-sentence', (req, res) => {
    try {
        const sentence = previewSlotSentence(req.body || {});
        res.json({ sentence });
    } catch (e) {
        console.error("Failed to preview sentence:", e);
        res.status(500).json({ error: "Failed to build sentence" });
    }
});

// [NEW] Get Prompt Enhancement Settings
app.get('/api/prompt-enhancement-settings', (req, res) => {
    try {
        const store = getProfileStore();
        const activeProfile = store.profiles.find(profile => profile.id === store.activeProfileId) || store.profiles[0];
        res.json({
            activeProfileId: store.activeProfileId,
            profiles: store.profiles,
            ...(activeProfile ? activeProfile.settings : {})
        });
    } catch (e) {
        console.error("Failed to get settings:", e);
        res.status(500).json({ error: "Failed to get settings" });
    }
});

// [NEW] Update Prompt Enhancement Settings
app.post('/api/prompt-enhancement-settings', (req, res) => {
    try {
        const newSettings = req.body || {};
        const success = Array.isArray(newSettings.profiles)
            ? saveProfileStore(newSettings)
            : saveSettings(newSettings);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: "Failed to save settings" });
        }
    } catch (e) {
        console.error("Failed to save settings:", e);
        res.status(500).json({ error: "Failed to save settings" });
    }
});

// --- Search API ---
app.post('/api/search-youtube', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query is required" });

    try {
        const results = await searchYouTube(query);
        res.json(results);
    } catch (e) {
        console.error("YouTube search failed:", e);
        res.status(500).json({ error: "YouTube search failed" });
    }
});

// --- Genre Guidelines API ---
app.get('/api/genre-guidelines', (req, res) => {
    try {
        const filePath = path.join(process.cwd(), 'style_templates', 'genre_tone_config.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({ genres: [] });
        }
    } catch (e) {
        console.error("Failed to get genre guidelines:", e);
        res.status(500).json({ error: "Failed to get genre guidelines" });
    }
});
// --- TTS API ---
app.post('/api/tts', async (req, res) => {
    try {
        const { text, options } = req.body;
        if (!text) return res.status(400).json({ error: "Text is required" });

        const buffer = synthesizeSpeechToWav(text, options);
        res.set('Content-Type', 'audio/wav');
        res.send(buffer);
    } catch (e) {
        console.error("TTS failed:", e);
        res.status(500).json({ error: "TTS failed" });
    }
});

// Use the error handler as the last middleware
app.use(ErrorHandler.expressErrorHandler());

// --- Cineboard Favorites API ---
app.get('/api/cineboard/favorites', (req, res) => {
    try {
        if (!fs.existsSync(FAVORITES_FILE)) {
            return res.json({ favorites: [] });
        }
        const data = fs.readFileSync(FAVORITES_FILE, 'utf8');
        const parsed = JSON.parse(data);
        res.json({ favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [] });
    } catch (e) {
        console.error("Failed to read favorites:", e);
        res.json({ favorites: [] });
    }
});

app.post('/api/cineboard/favorites', (req, res) => {
    try {
        const { folderName } = req.body;
        if (!folderName || typeof folderName !== 'string') {
            return res.status(400).json({ error: "Folder name is required" });
        }

        let favorites = [];
        if (fs.existsSync(FAVORITES_FILE)) {
            try {
                const data = fs.readFileSync(FAVORITES_FILE, 'utf8');
                const parsed = JSON.parse(data);
                favorites = Array.isArray(parsed.favorites) ? parsed.favorites : [];
            } catch { /* ignore */ }
        }

        // Check if already exists
        if (favorites.includes(folderName)) {
            return res.json({ success: true, message: "Already in favorites", favorites });
        }

        // Add new favorite
        favorites.push(folderName);
        fs.writeFileSync(FAVORITES_FILE, JSON.stringify({ favorites }, null, 2));
        console.log(`[Server] ⭐ Added to favorites: ${folderName}`);
        res.json({ success: true, favorites });
    } catch (e) {
        console.error("Failed to add favorite:", e);
        res.status(500).json({ error: "Failed to add favorite" });
    }
});

app.delete('/api/cineboard/favorites/:folderName', (req, res) => {
    try {
        const { folderName } = req.params;
        if (!folderName) {
            return res.status(400).json({ error: "Folder name is required" });
        }

        if (!fs.existsSync(FAVORITES_FILE)) {
            return res.status(404).json({ error: "Favorites file not found" });
        }

        const data = fs.readFileSync(FAVORITES_FILE, 'utf8');
        const parsed = JSON.parse(data);
        let favorites = Array.isArray(parsed.favorites) ? parsed.favorites : [];

        // Remove favorite
        const filteredFavorites = favorites.filter(f => f !== folderName);

        if (filteredFavorites.length === favorites.length) {
            return res.status(404).json({ error: "Folder not in favorites" });
        }

        fs.writeFileSync(FAVORITES_FILE, JSON.stringify({ favorites: filteredFavorites }, null, 2));
        console.log(`[Server] 🗑️ Removed from favorites: ${folderName}`);
        res.json({ success: true, favorites: filteredFavorites });
    } catch (e) {
        console.error("Failed to remove favorite:", e);
        res.status(500).json({ error: "Failed to remove favorite" });
    }
});

// ============================================
// 다운로드 폴더에서 영상 가져오기 API
// ============================================

// ============================================
// 비디오 프롬프트/생성 API
// ============================================

app.post('/api/video/refine-prompt', async (req, res) => {
    const { script, scriptLine, action, emotion, visualPrompt, targetAge, characterSlot } = req.body || {};
    if (!scriptLine && !visualPrompt) {
        return res.status(400).json({ error: 'scriptLine 또는 visualPrompt가 필요합니다.' });
    }

    const extractDialogue = (line = '') => {
        const singleStart = line.indexOf("'");
        if (singleStart !== -1) {
            const singleEnd = line.indexOf("'", singleStart + 1);
            if (singleEnd > singleStart) return line.slice(singleStart + 1, singleEnd).trim();
        }
        const doubleStart = line.indexOf('"');
        if (doubleStart !== -1) {
            const doubleEnd = line.indexOf('"', doubleStart + 1);
            if (doubleEnd > doubleStart) return line.slice(doubleStart + 1, doubleEnd).trim();
        }
        return '';
    };

    const baseDialogue = extractDialogue(String(scriptLine || ''));

    const prompt = [
        '당신은 영상 프롬프트 전문가입니다. 아래 정보를 참고해 비디오 프롬프트를 정교화하세요.',
        '',
        '- 전체 대본: ' + String(script || '').slice(0, 2000),
        '- 현재 문장: ' + String(scriptLine || ''),
        '- 행동: ' + String(action || ''),
        '- 감정: ' + String(emotion || ''),
        '- 시각 프롬프트: ' + String(visualPrompt || ''),
        '- 타겟 연령: ' + String(targetAge || ''),
        '- 캐릭터 슬롯: ' + String(characterSlot || ''),
        '',
        '출력은 반드시 JSON만:',
        '{',
        '  "refinedPrompt": "(짧고 선명한 영상 프롬프트)",',
        '  "dialogue": "(대사 있으면 그대로, 없으면 빈 문자열)"',
        '}'
    ].join('\n');

    try {
        await ensureBrowserReady('GEMINI');
        const raw = await generateContent('GEMINI', prompt);
        const extracted = extractValidJson(raw) || raw;
        const parsed = tryParse(extracted);

        if (parsed?.refinedPrompt) {
            return res.json({
                refinedPrompt: parsed.refinedPrompt,
                dialogue: parsed.dialogue || baseDialogue
            });
        }

        return res.json({
            refinedPrompt: String(visualPrompt || scriptLine || '').trim(),
            dialogue: baseDialogue
        });
    } catch (error) {
        console.error('[Video Refine] ❌ Failed:', error);
        return res.status(500).json({ error: error.message || '비디오 프롬프트 정교화 실패' });
    }
});

app.post('/api/video/generate-smart', async (req, res) => {
    const {
        refinedPrompt, storyId, storyTitle, sceneNumber, imageUrl,
        // VIDEO 탭 필드
        dialogue,
        // VOICE 탭 필드
        voiceType, narrationText, narrationEmotion, narrationSpeed,
        lipSyncSpeakerName, lipSyncLine, lipSyncEmotion, lipSyncTiming
    } = req.body || {};

    if (!refinedPrompt || typeof refinedPrompt !== 'string') {
        return res.status(400).json({ error: 'refinedPrompt가 필요합니다.' });
    }

    try {
        // 프롬프트에 dialogue와 voice 정보 추가
        let finalPrompt = refinedPrompt;

        // Dialogue 추가
        if (dialogue && dialogue.trim()) {
            finalPrompt += `\n\n[Character speaks: "${dialogue.trim()}"]`;
        }

        // Voice 정보 로깅 (향후 TTS 연동용)
        if (voiceType && voiceType !== 'none') {
            console.log(`[Video Generate] 🎤 Voice info - Type: ${voiceType}`);
            if (narrationText) console.log(`  - Narration: "${narrationText}" (${narrationEmotion || 'neutral'}, ${narrationSpeed || 'normal'})`);
            if (lipSyncLine) console.log(`  - LipSync: "${lipSyncLine}" by ${lipSyncSpeakerName || 'unknown'} (${lipSyncEmotion || 'neutral'}, ${lipSyncTiming || 'mid'})`);
        }

        console.log(`[Video Generate] 📝 Final prompt length: ${finalPrompt.length} chars`);

        const result = await generateVideoFX(finalPrompt, imageUrl);
        return res.json({
            success: true,
            status: result?.status || 'submitted',
            message: result?.message || '영상 생성 요청 완료',
            storyId: storyId || null,
            sceneNumber: sceneNumber || null,
            url: null
        });
    } catch (error) {
        console.error('[Video Generate] ❌ Failed:', error);
        return res.status(500).json({ error: error.message || '영상 생성 실패' });
    }
});

const os = await import('os');
const DOWNLOAD_WATCH_DIR = process.env.DOWNLOAD_DIR || path.join(os.homedir(), 'Downloads');

app.get('/api/video/temp-preview/:fileName', (req, res) => {
    try {
        const { fileName } = req.params;
        if (!fileName) return res.status(400).json({ error: '파일명이 필요합니다.' });

        const safeName = path.basename(fileName);
        const filePath = path.join(DOWNLOAD_WATCH_DIR, safeName);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
        }

        const stat = fs.statSync(filePath);
        const range = req.headers.range;
        if (!range) {
            res.writeHead(200, {
                'Content-Length': stat.size,
                'Content-Type': 'video/mp4'
            });
            fs.createReadStream(filePath).pipe(res);
            return;
        }

        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        const stream = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
            'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'video/mp4'
        });
        stream.pipe(res);
    } catch (error) {
        console.error('[Video Preview] ❌ Failed:', error);
        res.status(500).json({ error: error.message || '미리보기 생성 실패' });
    }
});


app.post('/api/video/import-from-downloads', async (req, res) => {
    const { storyId, storyTitle, sceneNumber, requestedAt } = req.body;  // [NEW] requestedAt 추가
    console.log(`[Video Import] 📋 받은 값: storyId="${storyId}", storyTitle="${storyTitle}", requestedAt=${requestedAt}`);

    try {
        console.log(`[Video Import] 📥 Scanning downloads folder: ${DOWNLOAD_WATCH_DIR}`);

        // 다운로드 폴더에서 mp4 파일 찾기
        if (!fs.existsSync(DOWNLOAD_WATCH_DIR)) {
            return res.status(404).json({ error: '다운로드 폴더를 찾을 수 없습니다.' });
        }

        const files = fs.readdirSync(DOWNLOAD_WATCH_DIR);
        const mp4Files = files
            .filter(f => f.toLowerCase().endsWith('.mp4'))
            .map(f => {
                const filePath = path.join(DOWNLOAD_WATCH_DIR, f);
                try {
                    const stat = fs.statSync(filePath);
                    return {
                        name: f,
                        path: filePath,
                        mtime: stat.mtimeMs,
                        size: stat.size
                    };
                } catch {
                    return null;
                }
            })
            .filter(Boolean)
            .sort((a, b) => b.mtime - a.mtime);

        if (mp4Files.length === 0) {
            return res.status(404).json({ error: '다운로드 폴더에 mp4 파일이 없습니다.' });
        }

        // [NEW] 타임스탬프 기반 매칭: requestedAt 이후 생성된 파일 중 가장 가까운 것 선택
        let targetFile = mp4Files[0];
        let matchedByTimestamp = false;

        if (requestedAt && typeof requestedAt === 'number') {
            const candidates = mp4Files.filter(f => f.mtime >= requestedAt);
            if (candidates.length > 0) {
                // 요청 시점 이후 파일 중 가장 빠른 것 선택 (가장 가까운 매칭)
                targetFile = candidates.sort((a, b) => a.mtime - b.mtime)[0];
                matchedByTimestamp = true;
                console.log(`[Video Import] 🎯 타임스탬프 매칭 성공: ${targetFile.name} (요청: ${new Date(requestedAt).toISOString()}, 파일: ${new Date(targetFile.mtime).toISOString()})`);
            } else {
                console.log(`[Video Import] ⚠️ 요청 시점(${new Date(requestedAt).toISOString()}) 이후 파일 없음, 최신 파일로 폴백`);
            }
        }

        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);

        if (targetFile.mtime < tenMinutesAgo) {
            const minutesAgo = Math.round((Date.now() - targetFile.mtime) / 60000);
            return res.status(200).json({
                success: false,
                requiresSelection: true,
                message: `최근 10분 내 다운로드된 영상이 없습니다. (가장 최근: ${minutesAgo}분 전)`,
                recentFiles: mp4Files.slice(0, 10).map(f => ({
                    name: f.name,
                    mtime: f.mtime,
                    size: f.size,
                    sizeFormatted: f.size > 1024 * 1024
                        ? `${(f.size / (1024 * 1024)).toFixed(2)}MB`
                        : `${Math.round(f.size / 1024)}KB`
                }))
            });
        }

        // 파일 크기 체크 (최소 100KB)
        if (targetFile.size < 100 * 1024) {
            return res.status(400).json({ error: '파일이 너무 작습니다. 다운로드가 완료되지 않았을 수 있습니다.' });
        }

        // 대본폴더로 복사
        const mediaDirs = ensureStoryMediaDirectories(storyId, storyTitle);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sceneLabel = sceneNumber ? `scene-${String(sceneNumber).padStart(2, '0')}` : 'scene';
        const newFilename = `${sceneLabel}_${timestamp}.mp4`;
        const targetPath = path.join(mediaDirs.videoDir, newFilename);

        // 파일 이동 (드라이브 간 이동 지원을 위해 try-catch 사용)
        try {
            fs.renameSync(targetFile.path, targetPath);
        } catch (err) {
            if (err.code === 'EXDEV') {
                // 서로 다른 드라이브 간 이동 시 복사 후 삭제
                fs.copyFileSync(targetFile.path, targetPath);
                fs.unlinkSync(targetFile.path);
                console.log(`[Video Import] 🔄 Cross-device move handled (C: -> ${targetPath.split(':')[0]}:)`);
            } else {
                throw err;
            }
        }

        const fileSizeKB = Math.round(targetFile.size / 1024);
        const fileSizeMB = (targetFile.size / (1024 * 1024)).toFixed(2);


        console.log(`[Video Import] ✅ Imported: ${targetFile.name} (${fileSizeMB}MB) → ${newFilename}`);

        const relativePath = `대본폴더/${mediaDirs.safeId}/video/${newFilename}`;

        res.json({
            success: true,
            originalFile: targetFile.name,
            filename: newFilename,
            url: `/generated_scripts/${relativePath}`,
            path: targetPath,
            size: targetFile.size,
            sizeFormatted: fileSizeKB > 1024 ? `${fileSizeMB}MB` : `${fileSizeKB}KB`,
            matchedByTimestamp: matchedByTimestamp  // [NEW] 타임스탬프 매칭 여부
        });

    } catch (error) {
        console.error('[Video Import] ❌ Failed:', error);
        res.status(500).json({ error: error.message || '영상 가져오기 실패' });
    }
});

// [NEW] 특정 파일 선택해서 가져오기 API
app.post('/api/video/import-specific', async (req, res) => {
    const { storyId, storyTitle, sceneNumber, fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: '파일명이 필요합니다.' });

    try {
        const safeName = path.basename(fileName);
        const sourcePath = path.join(DOWNLOAD_WATCH_DIR, safeName);
        if (!fs.existsSync(sourcePath)) {
            return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
        }

        const stat = fs.statSync(sourcePath);
        const mediaDirs = ensureStoryMediaDirectories(storyId, storyTitle);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sceneLabel = sceneNumber ? `scene-${String(sceneNumber).padStart(2, '0')}` : 'scene';
        const newFilename = `${sceneLabel}_${timestamp}.mp4`;
        const targetPath = path.join(mediaDirs.videoDir, newFilename);

        // 파일 이동 (드라이브 간 이동 지원)
        try {
            fs.renameSync(sourcePath, targetPath);
        } catch (err) {
            if (err.code === 'EXDEV') {
                fs.copyFileSync(sourcePath, targetPath);
                fs.unlinkSync(sourcePath);
            } else {
                throw err;
            }
        }

        const fileSizeKB = Math.round(stat.size / 1024);
        const fileSizeMB = (stat.size / (1024 * 1024)).toFixed(2);
        const relativePath = `대본폴더/${mediaDirs.safeId}/video/${newFilename}`;

        res.json({
            success: true,
            originalFile: safeName,
            filename: newFilename,
            url: `/generated_scripts/${relativePath}`,
            sizeFormatted: fileSizeKB > 1024 ? `${fileSizeMB}MB` : `${fileSizeKB}KB`
        });
    } catch (error) {
        console.error('[Video Import Specific] ❌ Failed:', error);
        res.status(500).json({ error: error.message || '영상 가져오기 실패' });
    }
});

// 다운로드 폴더 경로 확인 API
app.get('/api/video/download-folder-info', (req, res) => {
    try {
        const os = require('os');
        const downloadDir = process.env.DOWNLOAD_DIR || path.join(os.homedir(), 'Downloads');
        const exists = fs.existsSync(downloadDir);

        let recentFiles = [];
        if (exists) {
            const files = fs.readdirSync(downloadDir);
            recentFiles = files
                .filter(f => f.toLowerCase().endsWith('.mp4'))
                .map(f => {
                    try {
                        const stat = fs.statSync(path.join(downloadDir, f));
                        return { name: f, mtime: stat.mtimeMs };
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean)
                .sort((a, b) => b.mtime - a.mtime)
                .slice(0, 5);
        }

        res.json({
            downloadDir,
            exists,
            recentMp4Files: recentFiles
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`[Server] 🚀 Script generator server running at http://localhost:${PORT}`);
});
