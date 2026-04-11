import fs from 'fs';
import path from 'path';

// 방금 수정한 로직(lockedOutfits 포함)을 반영한 테스트 폴더 생성
const TARGET_DIR = path.join('f:/test/쇼츠대본생성기-v3.5.3/generated_scripts/대본폴더');
const NOW = new Date();
const TIMESTAMP = NOW.getFullYear().toString().slice(-2) +
        (NOW.getMonth() + 1).toString().padStart(2, '0') +
        NOW.getDate().toString().padStart(2, '0') + '_' +
        NOW.getHours().toString().padStart(2, '0') +
        NOW.getMinutes().toString().padStart(2, '0');

const FOLDER_NAME = `${TIMESTAMP}_의상_테스트_대본`;
const FOLDER_PATH = path.join(TARGET_DIR, FOLDER_NAME);

if (!fs.existsSync(FOLDER_PATH)) {
    fs.mkdirSync(FOLDER_PATH, { recursive: true });
}
if (!fs.existsSync(path.join(FOLDER_PATH, 'images'))) {
    fs.mkdirSync(path.join(FOLDER_PATH, 'images'), { recursive: true });
}

const sourceFile = fs.readFileSync('f:/test/쇼츠대본생성기-v3.5.3/받은대본.txt', 'utf8');

// 대본 텍스트 추출 (Line 1318 ~ 1340)
const scriptLines = [
    "봄꽃보다 더 화사한 혜진이가 필드에 나타나면 골프장은 순간 패션쇼 런웨이가 되어버려요",
    "파스텔톤 스커트 사이로 보이는 늘씬한 각선미는 정말 모델 뺨치는 수준이었죠",
    "혜진이가 티박스에 올라서자마자 벚꽃 잎이 흩날리며 비현실적인 아우라를 뿜어내더라고요",
    "수애는 그 모습 보면서 입술을 꽉 깨물고는 연습 스윙을 미친 듯이 하대요",
    "혜진이가 생긋 웃으면서 '오늘 날씨가 너무 예뻐서 공이 안 맞으면 어떡해?'라며 콧노래를 불러요",
    "풀스윙하는 찰나에 바람에 머릿결이 찰랑이는데 뒤태가 진짜 여신 그 자체였거든요",
    "그런데 혜진이가 힘껏 휘두른 드라이버 샷이 꽃나무 정중앙을 강타해버렸어요",
    "우수수 떨어지는 꽃비 속에서 혜진이가 당황하며 눈을 깜빡이는데 눈빛이 참 처연하더라고요",
    "캐디 언니가 한숨을 내쉬며 '혜진 님, 꽃 구경은 그만하시고 로스트볼 하나 더 꺼내세요'라고 팩폭을 날려요",
    "알고 보니 혜진이는 공 맞히는 것보다 사진 백 장 찍는 게 오늘 진정한 목표였던 거죠",
    "혜진이는 쿨하게 '수애야, 공은 중요하지 않아, 내 인생샷 건졌으면 된 거지!'라며 포즈를 잡아요",
    "결국 스코어는 엉망진창이지만 앨범만큼은 우승컵 따놓은 것 같은 우리들의 봄 소풍이었네요"
];

const scriptBody = scriptLines.join('\n');

const jsonMatch = sourceFile.match(/({\s*"lockedOutfits"[\s\S]*)/);
let rawJsonText = "";
let parsedJson = null;

if (jsonMatch) {
    rawJsonText = jsonMatch[1];
    try {
        parsedJson = JSON.parse(rawJsonText);
    } catch (e) {
        console.error("JSON 파싱 에러", e);
    }
}

if (!parsedJson) {
    console.error("JSON 파싱 실패");
    process.exit(1);
}

const llmLockedOutfits = parsedJson.lockedOutfits || {};
const scenes = parsedJson.scenes || [];

// 원본 raw JSON 파일 생성
const rawFileName = `[GEMINI] ${TIMESTAMP.replace('_', '-').replace(/:/g, '')}_raw_llm_response.txt`;
fs.writeFileSync(path.join(FOLDER_PATH, rawFileName), rawJsonText);

// 통합 페이로드 생성 (수정한 로직 반영된 형태)
const consolidatedPayload = {
    title: '의상_테스트_대본',
    scriptBody: scriptBody,
    scenes: scenes,
    lockedOutfits: llmLockedOutfits, // ⬅️ 추가된 핵심 부분
    characters: [
        { id: "WomanA", name: "혜진", isProtagonist: true },
        { id: "WomanB", name: "수애", isProtagonist: false },
        { id: "WomanC", name: "친구", isProtagonist: false },
        { id: "WomanD", name: "캐디", isProtagonist: false }
    ],
    lineCharacterNames: [],
    source: 'manual'
};

const payloadFileName = `[GEMINI] ${TIMESTAMP.replace('_', '-').replace(/:/g, '')}_의상_테스트_대본.txt`;
fs.writeFileSync(path.join(FOLDER_PATH, payloadFileName), JSON.stringify(consolidatedPayload, null, 2));

console.log(`폴더 생성 성공: ${FOLDER_NAME}`);
