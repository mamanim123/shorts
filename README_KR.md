# 쇼츠 대본 생성기 v5

## 📋 프로그램 개요

AI를 활용하여 **한국형 쇼츠 콘텐츠 대본**과 **고품질 이미지 프롬프트**를 자동 생성하는 웹 애플리케이션입니다.

### 주요 기능
- 🎬 **6컷 쇼츠 대본 자동 생성** (Hook → Flow → Climax → Punchline 구조)
- 🖼️ **이미지 프롬프트 생성** (Short/Long 프롬프트, Sora 비디오 프롬프트)
- 🤖 **멀티 AI 지원** (Gemini, ChatGPT, Claude)
- 👗 **V3 럭셔리 엔진** (고급 패션, 골프장 배경, 글래머러스 스타일)
- 📊 **스타일 템플릿 분석** (기존 대본 분석 후 재생성)
- 💾 **히스토리 관리** (생성 기록 저장, 즐겨찾기)

---

## 🏗️ 시스템 아키텍처

### 기술 스택
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express
- **AI Automation**: Puppeteer (브라우저 자동화)
- **AI Models**: Google Gemini API, ChatGPT (Web), Claude (Web)

### 디렉토리 구조
```
쇼츠대본생성기-v5/
├── src/                    # React 프론트엔드
│   ├── App.tsx            # 메인 애플리케이션
│   ├── components/        # UI 컴포넌트
│   └── services/          # AI 서비스 로직
├── server/                # Node.js 백엔드
│   ├── index.js          # Express 서버 + 후처리
│   └── puppeteerHandler.js # AI 브라우저 자동화
├── constants.ts          # 시스템 프롬프트, 의상 데이터
├── types.ts             # TypeScript 타입 정의
└── generated_scripts/   # 생성된 대본 저장
```

---

## 🔄 데이터 흐름

```
[사용자 입력]
    ↓
[React Frontend (App.tsx)]
    ↓
[geminiService.ts - 프롬프트 구성]
    ↓
[Backend API (/api/generate)]
    ↓
[Puppeteer - AI 웹 자동화]
    ↓
[AI 응답 (JSON)]
    ↓
[서버 후처리 (이미지 프롬프트 강화)]
    ↓
[Frontend - 결과 표시]
```

---

## ⚙️ 핵심 기능 상세

### 1. V3 럭셔리 엔진

**특징**:
- 고급 패션 스타일 (Ultra-tight, Glamorous, High-Fashion)
- 골프장 배경 (Luxury Golf Aesthetic)
- 6가지 매운맛 단계 (선택안함 ~ 고전 거래/역전)

**의상 시스템**:
- 8가지 스타일 컬렉션 (시그니처, 올 블랙, 레드, 화이트, 골프, 파티, 랜덤, Sexy)
- 각 스타일별 10개 이상의 의상 아이템
- 헤어스타일 자동 매칭

**코드 위치**: `services/geminiService.ts` (Line 451~900)

---

### 2. 멀티 AI 지원

**지원 모델**:
1. **Gemini** (API 방식)
   - 가장 안정적
   - API 키 필요 (`.env.local`)
   
2. **ChatGPT** (웹 자동화)
   - 안전 필터 우회 로직 포함
   - 후처리로 프롬프트 강화
   
3. **Claude** (웹 자동화)
   - 토큰 절약 모드 (6컷 최적화)

**코드 위치**: 
- `server/puppeteerHandler.js` (브라우저 자동화)
- `constants.ts` (각 AI별 시스템 프롬프트)

---

### 3. 이미지 프롬프트 후처리 시스템

**문제**: ChatGPT가 안전 필터로 인해 몸매 표현을 순화함
- 입력: "Sculpted hourglass silhouette"
- GPT 출력: "Athletic build"

**해결책**: 서버에서 자동 강화
```javascript
// server/index.js (Line 376~443)
parsedData.scenes = parsedData.scenes.map(scene => {
    // 여성 캐릭터 감지
    if (hasFemaleCharacter(scene.longPrompt)) {
        // 자동으로 키워드 추가
        scene.longPrompt += ", Sculpted hourglass silhouette, 
                             Graceful S-line curves, 
                             Model-like proportions, ..."
    }
});
```

**추가되는 키워드**:
- Sculpted hourglass silhouette
- Form-fitting luxurious fabric
- Graceful S-line curves
- Model-like proportions
- Elegant refined posture
- Sophisticated glamorous beauty

---

### 4. 안정성 개선 (타임아웃 방지)

**문제**: GPT가 긴 대본 생성 시 중간에 끊김

**해결책**:
1. **서버 타임아웃 연장**: 2분 → 10분
2. **Puppeteer 폴링 연장**: 5분 → 10분
3. **안정화 체크 강화**: 4초 → 10초
4. **Continue 버튼 자동 클릭**: 답변이 길어서 중단되면 자동으로 "Continue generating" 클릭

**코드 위치**:
- `server/index.js` (Line 386~389)
- `server/puppeteerHandler.js` (Line 122~152)

---

### 5. JSON 수동 입력 복구

**문제**: GPT 출력 JSON에 이스케이프되지 않은 따옴표 포함
```json
{"scriptBody": "김여사가 말했다, "오늘 정말..."} // ❌ 파싱 실패
```

**해결책**: 3단계 복구 시스템
1. 표준 `JSON.parse()` 시도
2. `jsonrepair` 라이브러리로 복구
3. 커스텀 따옴표 이스케이프 처리

**코드 위치**: `App.tsx` (Line 152~199)

---

## 🎨 매운맛 단계별 시나리오

### 0. 선택안함 (AI 자율 생성)
- AI가 캐릭터 수와 의상을 자유롭게 디자인
- 여성 캐릭터는 반드시 "Tight, Short, Glamorous" 제약 준수

### 1. 남편의 속마음 (현실 풍자)
- 남편(Man B) + 아내(Woman A)
- 남편의 내면 독백 중심

### 2. 사모님의 유혹 (연하남 헌팅)
- 사모님(Woman A) + 젊은 남성(Man B)
- 유혹과 반전

### 3. 뒷모습 반전 (착각과 망신)
- 뒷모습 → 앞모습 반전 구조

### 4. 유머 썰 (아재 개그)
- 가벼운 유머, 언어유희

### 5. 19금 (성인 유머)
- 이중 의미 (Double Entendre)
- 예: "골프 샤프트" vs "성적 암시"

### 6. 고전 거래/역전 (블랙코미디)
- 거래 → 빚 → 조건 역전
- 권력 관계 뒤집기

**코드 위치**: `services/geminiService.ts` (Line 538~866)

---

## 🚀 실행 방법

### 1. 환경 설정
```bash
# 의존성 설치
npm install

# 환경 변수 설정 (.env.local)
GEMINI_API_KEY=your_api_key_here
```

### 2. 서버 실행
```bash
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3002`

### 3. AI 브라우저 열기
1. UI에서 AI 서비스 선택 (Gemini/ChatGPT/Claude)
2. "브라우저 열기" 버튼 클릭
3. 수동으로 로그인 (최초 1회)

---

## 📊 주요 파일 설명

### `constants.ts`
- **시스템 프롬프트**: 각 AI별 지시사항
- **의상 컬렉션**: 8가지 스타일별 의상 데이터
- **헤어스타일**: 20가지 헤어스타일 목록

### `services/geminiService.ts`
- **프롬프트 구성 로직**: 사용자 입력 → AI 프롬프트 변환
- **V3 변수 생성**: 의상/헤어 랜덤 선택
- **시나리오 분기**: 매운맛 단계별 캐릭터/시나리오 설정

### `server/index.js`
- **Express 서버**: API 라우팅
- **JSON 파싱**: 5가지 전략으로 AI 응답 파싱
- **후처리**: 이미지 프롬프트 자동 강화

### `server/puppeteerHandler.js`
- **브라우저 자동화**: AI 웹 인터페이스 제어
- **응답 대기**: Continue 버튼 자동 클릭, 안정화 체크
- **서비스별 셀렉터**: Gemini/ChatGPT/Claude 각각 다른 DOM 셀렉터

### `App.tsx`
- **메인 UI**: 설정 패널, 결과 표시, 히스토리
- **상태 관리**: 생성된 대본, 템플릿, 롱폼 세션
- **JSON 수동 입력**: 복구 로직 포함

---

## 🔧 고급 기능

### 스타일 템플릿 분석
1. 기존 대본을 "대본 분석" 탭에 입력
2. AI가 구조, 톤, 반전 패턴 분석
3. 분석 결과를 템플릿으로 저장
4. 새 대본 생성 시 템플릿 선택하여 스타일 재현

**코드 위치**: `services/templateService.ts`

### 롱폼 콘텐츠 생성
1. "롱폼" 탭에서 주제 입력
2. AI가 챕터별 요약 생성
3. 각 챕터 승인/거부
4. 승인된 챕터의 상세 내용 생성

**코드 위치**: `services/longformService.ts`

---

## 🐛 문제 해결

### 1. "AI output is not valid JSON" 오류
**원인**: AI가 JSON 외 텍스트 포함
**해결**: 서버가 자동으로 5가지 전략으로 파싱 시도

### 2. 타임아웃 오류
**원인**: AI 응답이 10분 이상 소요
**해결**: `server/index.js`와 `puppeteerHandler.js`의 타임아웃 값 증가

### 3. 이미지 프롬프트가 너무 단순함
**원인**: ChatGPT가 안전 필터로 순화
**해결**: 서버 후처리가 자동으로 강화 (재시작 필요)

### 4. 여성 캐릭터가 모두 똑같음
**원인**: AI가 구분하지 않음
**해결**: `geminiService.ts`에 "DISTINCT VISUALS" 규칙 추가됨

---

## 📝 개발 히스토리

### 2025-12-03
- ✅ AI 거부 문제 해결 (Spice Level 0)
- ✅ 타임아웃 문제 해결 (10분 연장)
- ✅ JSON 수동 입력 복구 기능
- ✅ Continue 버튼 자동 클릭
- ✅ 여성 캐릭터 구분 강화
- ✅ 이미지 프롬프트 후처리 시스템

---

## 📄 라이선스

이 프로젝트는 개인 사용 목적으로 제작되었습니다.

---

## 👨‍💻 기술 지원

문제 발생 시:
1. `generated_scripts/` 폴더의 최근 JSON 파일 확인
2. 브라우저 콘솔 (F12) 에러 확인
3. 서버 터미널 로그 확인
4. `debug_claude.html` 파일 확인 (Claude 사용 시)
