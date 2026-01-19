const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'engine_config.json');
let configText;
try {
    configText = fs.readFileSync(configPath, 'utf8');
} catch (e) {
    console.error('Failed to read file:', e);
    process.exit(1);
}

let config;
try {
    config = JSON.parse(configText);
} catch (e) {
    console.error('Failed to parse JSON:', e.message);
    const match = e.message.match(/at position (\d+)/);
    if (match) {
        const pos = parseInt(match[1]);
        console.error('Context around error:', configText.substring(Math.max(0, pos - 50), Math.min(configText.length, pos + 50)));
    }
    process.exit(1);
}

const NEW_SLOT_SYSTEM = `==========================================================
## 2.5 캐릭터 Slot 시스템 v2.0 (성별 분리)
==========================================================

[중요: 이 시스템은 여성과 남성 캐릭터를 명확히 구분하여 LLM의 혼동을 방지합니다.]

### 공통 핵심 규칙 (CRITICAL)
- 여성 캐릭터: Slot Woman A/B/C
- 남성 캐릭터: Slot Man A/B/C
- 캐릭터의 핵심 신체 특성, 헤어 스타일, 분위기(vibe)는 Slot 단위로 고정됩니다.
- 씬이 변경되어도 Slot별 헤어·체형·존재감은 절대 변경되지 않습니다.
- 변경 가능한 요소는 의상(outfits)과 액세서리(accessories)만 허용됩니다.
- 동일 영상 내 같은 성별 캐릭터 간 헤어 스타일 중복은 절대 금지합니다.

---

### 👩 Slot Woman A — 여성 주인공 / POV 앵커
(대표 이름: 김여사)
- 역할: 여성 메인 주인공, 시점(POV)을 고정하는 중심 인물
- 등장 규칙: 여성 주인공이 필요한 모든 씬에 등장

[외형 고정]
- 체형: 볼륨감 있는 아워글래스 (Voluptuous hourglass figure)
- 전체 인상: 성숙함, 우아함, 주도적인 존재감 (Confident presence)

[헤어 고정]
- 긴 부드러운 웨이브 헤어 (Long soft-wave hairstyle)
- 길이·질감·스타일은 모든 씬에서 동일하게 유지

---

### 👩 Slot Woman B — 여성 서브 / 감정 반응
(대표 이름: 이여사)
- 역할: 여성 서브 캐릭터, 감정 반응 및 대비 포인트
- 등장 규칙: 여성 캐릭터가 2명 이상일 때 활성화

[외형 고정]
- 체형: 아담하고 작지만 굴곡 있는 체형 (Petite frame with glamorous curves)
- 전체 인상: 솔직함, 감정이 얼굴에 잘 드러나는 분위기

[헤어 고정]
- 짧은 시크 보브컷 (Short chic bob cut)
- 모든 씬에서 동일한 길이와 스타일 유지

---

### 👩 Slot Woman C — 여성 서브 / 균형 관찰자
(대표 이름: 박여사)
- 역할: 여성 서브 캐릭터, 상황 관찰자 및 균형추
- 등장 규칙: 여성 캐릭터가 3명일 때 활성화

[외형 고정]
- 체형: 탄탄한 운동형 체형 (Athletic and toned build)
- 전체 인상: 차분함, 냉정함, 거리 유지

[헤어 고정]
- 로우 포니테일 (Low ponytail hairstyle)
- 모든 씬에서 동일한 스타일 유지

---

### 👨 Slot Man A — 남성 주인공
(대표 이름: 김프로)
- 역할: 남성 메인 캐릭터
- 등장 규칙: 남성 주인공이 필요한 씬에 등장

[외형 고정]
- 체형: 탄탄한 운동형 체형 (Fit and athletic build)
- 전체 인상: 댄디함, 자신감 있는 존재감 (Dandy and confident presence)

[헤어 고정]
- 짧고 깔끔한 헤어 스타일 (Short neat hairstyle)
- 모든 씬에서 동일하게 유지

---

### 👨 Slot Man B — 남성 서브
(대표 이름: 박사장)
- 역할: 남성 서브 캐릭터
- 등장 규칙: 남성 캐릭터가 2명 이상일 때 활성화

[외형 고정]
- 체형: 건장한 댄디 체형 (Well-built dandy physique)
- 전체 인상: 중후함 또는 활동적인 인상

[헤어 고정]
- 깔끔한 숏컷 (Clean short cut)
- 모든 씬에서 동일하게 유지

---

### 👨 Slot Man C — 남성 서브 / 관찰자
(대표 이름: 최프로)
- 역할: 남성 서브 캐릭터, 관찰자
- 등장 규칙: 남성 캐릭터가 3명일 때 활성화

[외형 고정]
- 체형: 안정적인 운동형 체형 (Stable athletic frame)
- 전체 인상: 차분하고 신뢰감 있는 인상

[헤어 고정]
- 자연스러운 숏 스타일 (Natural short style)
- 모든 씬에서 동일하게 유지`;

const oldSlotRegex = /## 2\.5 캐릭터 슬롯 시스템[\s\S]*?(\n\n##|\n\n###|\n\n---|\n\n\d+\.|$)/g;
const oldSlotRegex2 = /### 2\.5 캐릭터 슬롯 시스템[\s\S]*?(\n\n##|\n\n###|\n\n---|\n\n\d+\.|$)/g;
const simpleSlotRegex = /- Slot A\(주인공\)를 기본으로 사용하되[\s\S]*?명시한다\./g;

let updatedCount = 0;

for (const key in config.prompts) {
    let prompt = config.prompts[key];
    if (typeof prompt !== 'string') continue;

    let updated = false;

    if (oldSlotRegex.test(prompt)) {
        prompt = prompt.replace(oldSlotRegex, (match, p1) => NEW_SLOT_SYSTEM + p1);
        updated = true;
    } else if (oldSlotRegex2.test(prompt)) {
        prompt = prompt.replace(oldSlotRegex2, (match, p1) => NEW_SLOT_SYSTEM + p1);
        updated = true;
    } else if (simpleSlotRegex.test(prompt)) {
        prompt = prompt.replace(simpleSlotRegex, NEW_SLOT_SYSTEM);
        updated = true;
    }

    if (prompt.includes('Slot A') || prompt.includes('Slot B') || prompt.includes('Slot C') || prompt.includes('narrator')) {
        prompt = prompt.replace(/Slot A/g, 'Slot Woman A');
        prompt = prompt.replace(/Slot B/g, 'Slot Woman B');
        prompt = prompt.replace(/Slot C/g, 'Slot Woman C');
        prompt = prompt.replace(/ — narrator/g, '');
        prompt = prompt.replace(/ — 화자/g, '');
        updated = true;
    }

    if (updated) {
        config.prompts[key] = prompt;
        updatedCount++;
    }
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
console.log(`Successfully updated ${updatedCount} prompts in engine_config.json`);
