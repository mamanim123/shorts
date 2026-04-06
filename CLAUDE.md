# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 프로젝트 개요

**쇼츠대본생성기 v3.5.3** - AI 기반 완전 자동화 쇼츠 영상 제작 플랫폼 (v2.5.2)

- 17개의 AI 모드로 쇼츠 영상을 автомат화로 제작
- 쇼츠 대본 생성 → 이미지 생성 → 영상 합성 → TTS 음성 생성까지 원스톱 워크플로우
- 목표: 9.5분 안에 쇼츠 영상 제작 (기존 3-4시간 대비 96% 시간 단축)

---

## 주요 기술 스택

| 영역 | 기술 |
|------|------|
| **프론트엔드** | React 19, TypeScript, Vite 6, Tailwind CSS |
| **백엔드** | Express 5 (Node.js), Puppeteer (브라우저 자동화) |
| **AI** | Google Gemini API, OpenAI API |
| **영상** | FFmpeg (영상 합성), Sharp (이미지 처리) |
| **기타** | JSZip, Multer (파일 업로드), Web Speech API |

---

## 프로젝트 구조

```
쇼츠대본생성기-v3.5.3/
├── ai_studio_bundle/              # AI Studio 프론트엔드 (React + TypeScript)
│   ├── App.tsx                    # 메인 앱 컴포넌트 (17개 모드 관리)
│   ├── index.tsx                  # React 진입점
│   ├── types.ts                   # TypeScript 타입 정의
│   ├── vite.config.ts             # Vite 설정
│   ├── components/                # UI 컴포넌트 (21개)
│   │   ├── CameraControls.tsx     # 카메라 설정
│   │   ├── FrameGenerator.tsx     # 프레임 생성
│   │   ├── SceneCreator.tsx       # 신 영상 합성
│   │   ├── ImageAnalyzer.tsx      # 이미지 분석
│   │   ├── VoiceStudio.tsx        # TTS 음성 스튜디오
│   │   ├── StyleTransfer.tsx      # 스타일 이전
│   │   ├── ColorChanger.tsx       # 색상 변경
│   │   ├── PoseTransfer.tsx       # 포즈 이전
│   │   ├── FaceCorrection.tsx     # 얼굴 보정
│   │   ├── SkinToneAdjuster.tsx   # 피부톤 조절
│   │   ├── HairMakeup.tsx         # 헤어 & 메이크업
│   │   ├── ObjectRemover.tsx      # 객체 제거
│   │   ├── AspectRatioConverter.tsx # 종횡비 변환
│   │   ├── ImageCleaner.tsx       # 이미지 정리
│   │   └── ...
│   └── services/
│       └── geminiService.ts       # Gemini API 연동
├── server/                        # Express 백엔드
│   ├── index.js                   # 메인 서버 진입점 (포트 3002)
│   ├── puppeteerHandler.js        # Puppeteer 브라우저 자동화
│   ├── youtubeSearchHandler.js    # YouTube 검색 핸들러
│   ├── promptEnhancer.js          # 프롬프트 향상 (캐릭터/설정)
│   ├── logger.js                  # 로깅
│   ├── errorHandler.js            # 에러 핸들러
│   └── user_data_*/               # Puppeteer 사용자 데이터 폴더들
├── generated_scripts/             # 생성된 대본 및 결과물 저장
├── docs/                          # 문서
│   ├── AI_Studio_사용자_가이드.md
│   ├── AI_Studio_개발자_가이드.md
│   └── ...
└── plans/                         # 개발 계획
```

---

## 개발 명령어

```bash
# 개발 서버 실행 (동시 실행: Express 서버 + Vite 프론트엔드)
npm run dev

# Express 서버만 실행 (포트 3002)
npm run server

# 프론트엔드 빌드
npm run build

# 빌드 미리보기
npm run preview
```

### 브라우저URL
- **프론트엔드**: http://localhost:3000 (Vite)
- **백엔드 API**: http://localhost:3002 (Express)

---

## 환경 변수 설정

프로젝트 루트에 `.env` 파일 생성:

```env
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
DAILY_REQUEST_LIMITS_JSON={"generation": 25, "video": 10}
```

---

## 아키텍처 요약

### 1. 프론트엔드 (`ai_studio_bundle/`)
- **단일 페이지 애플리케이션** (Vite + React + TypeScript)
- **17개 모드**: 이미지 퓨전, 텍스트→이미지, 동영상 생성, 카메라 컨트롤, 프레임 생성, 신 제작, 이미지 분석, 보이스 스튜디오, 스타일 이전, 색상 변경, 포즈 이전, 얼굴 보정, 피부톤 조절, 헤어/메이크업, 객체 제거, 종횡비 변환, 이미지 정리
- **그룹화된 모드 UI**: 제작준비 → 신 구축 → 향상 → 광택 → 오디오 → 유틸리티

### 2. 백엔드 (`server/`)
- **Express 서버** (포트 3002): RESTful API
- **Puppeteer 자동화**: Gemini/Grok 웹사이트와 브라우저 자동화
- **프롬프트 엔진**: 캐릭터 맵, 스타일 템플릿, 장르 가이드라인
- **생성물 관리**: 대본, 이미지, 영상, 음성 파일 저장소

### 3. 핵심 워크플로우

```
대본 생성 → 캐릭터 이미지 업로드 → 카메라 설정 → 프레임 생성(3분)
→ 이미지 편집 → 영상 합성(2분) → 음성 생성(1분) → 완성
```

---

## 주요 파일

| 파일 | 역할 |
|------|------|
| `ai_studio_bundle/App.tsx` | 메인 React 앱 - 모든 모드 라우팅 및 상태 관리 |
| `ai_studio_bundle/services/geminiService.ts` | Gemini API 호출 함수들 |
| `server/index.js` | Express 서버 - API 라우트, 파일 관리 |
| `server/puppeteerHandler.js` | Puppeteer 브라우저 풀 및 자동화 |
| `server/promptEnhancer.js` | 캐릭터 기반 프롬프트 향상 |
| `ai_studio_bundle/types.ts` | TypeScript 타입 정의 |

---

## 주의사항

- **Puppeteer 사용자 데이터 폴더**: `server/user_data_*/` 는 브라우저 세션 데이터용 - 삭제 금지
- **생성물 저장소**: `generated_scripts/` - 생성된 대본, 이미지, 영상 저장
- **FFmpeg 필요**: 영상 합성 기능에 필수, 시스템에 사전 설치 필요
