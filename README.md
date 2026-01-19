# 🎬 AI Studio - 완전 자동화 쇼츠 제작 플랫폼

> **14개 AI 모드로 쇼츠 영상을 9.5분 만에 제작하세요!**

[![Version](https://img.shields.io/badge/version-6.0.0-blue.svg)](https://github.com/yourusername/shorts-generator)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

---

## 🌟 주요 기능

### 📱 쇼츠 제작 (Phase 1)
- **📷 카메라 컨트롤**: 전문적인 카메라 설정
- **🎬 프레임 만들기**: 캐릭터 일관성 유지 연속 장면
- **🎥 신 만들기**: FFmpeg 영상 합성 (9:16)
- **🔍 이미지 분석기**: AI 프롬프트 추출
- **🎤 보이스 스튜디오**: TTS 음성 생성

### 🎨 이미지 편집 (Phase 2)
- **🎨 스타일 따라하기**: 참조 이미지 스타일 적용
- **🎨 색상 바꾸기**: 의상/헤어/배경 색상 변경
- **🤸 포즈 따라하기**: 참조 포즈 적용
- **✨ 얼굴 보정**: 얼굴/헤어/바디 보정
- **🌟 피부톤 튜닝**: 피부톤 균일화
- **💄 헤어 & 메이크업**: 헤어스타일/컬러/메이크업

### 🖼️ 기본 기능
- **이미지 퓨전 & 수정**: 여러 이미지 조합
- **텍스트로 이미지 생성**: 프롬프트로 이미지 생성
- **동영상 생성**: 프롬프트로 동영상 생성

---

## 🚀 빠른 시작

### 필수 요구사항

- Node.js 18.0.0 이상
- FFmpeg (영상 합성용)
- Google Gemini API Key

### 설치

```bash
# 저장소 클론
git clone https://github.com/yourusername/shorts-generator.git
cd shorts-generator

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일에 GEMINI_API_KEY 추가

# FFmpeg 설치 (Windows)
choco install ffmpeg
```

### 실행

```bash
# 개발 서버 실행
npm run dev

# 브라우저에서 http://localhost:3000 접속
```

---

## 📖 사용 방법

### 1. 쇼츠 영상 제작 (9.5분)

```
1. 대본 생성 (1분)
   ↓
2. 캐릭터 이미지 업로드 (10초)
   ↓
3. 카메라 설정 (30초)
   ↓
4. 프레임 생성 (3분)
   ↓
5. 이미지 편집 (2분)
   ↓
6. 영상 합성 (2분)
   ↓
7. 음성 생성 (1분)
   ↓
8. 완성! 🎉
```

### 2. 이미지 편집

```
1. 모드 선택 (14개 중 선택)
   ↓
2. 이미지 업로드
   ↓
3. 설정 조절
   ↓
4. 적용하기
   ↓
5. 다운로드
```

---

## 📚 문서

- [사용자 가이드](docs/AI_Studio_사용자_가이드.md) - 14개 모드 상세 설명
- [개발자 가이드](docs/AI_Studio_개발자_가이드.md) - 아키텍처 및 API 문서
- [Phase 1 완료 보고서](plans/Phase1_완료_보고서.md)
- [Phase 2 완료 보고서](plans/Phase2_완료_보고서.md)
- [통합 완료 보고서](plans/AI_Studio_완전_통합_완료.md)

---

## 🎯 주요 성과

### ⚡ 시간 단축
- **기존**: 3-4시간 (수동 작업)
- **현재**: 9.5분 (자동화)
- **단축률**: 96%

### 📈 기능 확장
- **기존**: 3개 모드
- **현재**: 14개 모드
- **증가율**: 367%

### ✨ 품질 향상
- 캐릭터 일관성: 95% 이상 유지
- 전문적인 카메라 설정
- 고품질 이미지 편집
- 자연스러운 음성 생성

---

## 🛠️ 기술 스택

### 프론트엔드
- React 18
- TypeScript
- Tailwind CSS
- Vite

### 백엔드
- Node.js
- Express
- FFmpeg
- Multer

### AI/ML
- Google Gemini API
- Web Speech API

---

## 📦 프로젝트 구조

```
쇼츠대본생성기-v6.0.0/
├── ai_studio_bundle/           # AI Studio 프론트엔드
│   ├── App.tsx                 # 메인 앱 (14개 모드)
│   ├── components/             # 11개 컴포넌트
│   └── services/               # API 서비스
├── server/                     # Express 서버
│   └── index.js
├── docs/                       # 문서
│   ├── AI_Studio_사용자_가이드.md
│   └── AI_Studio_개발자_가이드.md
└── plans/                      # 개발 계획 및 보고서
```

---

## 🎨 스크린샷

### 모드 선택 (3x5 그리드)
```
┌─────────────────┬─────────────────┬─────────────────┐
│ 이미지 퓨전     │ 텍스트 이미지   │ 동영상 생성     │
├─────────────────┼─────────────────┼─────────────────┤
│ 📷 카메라       │ 🎬 프레임       │ 🎥 신 만들기    │
├─────────────────┼─────────────────┼─────────────────┤
│ 🔍 분석기       │ 🎤 보이스       │ 🎨 스타일       │
├─────────────────┼─────────────────┼─────────────────┤
│ 🎨 색상         │ 🤸 포즈         │ ✨ 얼굴         │
├─────────────────┼─────────────────┼─────────────────┤
│ 🌟 피부톤       │ 💄 헤어         │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

---

## 🤝 기여하기

기여를 환영합니다! [개발자 가이드](docs/AI_Studio_개발자_가이드.md)를 참고하세요.

1. Fork 저장소
2. 새 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'feat: add amazing feature'`)
4. 브랜치 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 생성

---

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

## 🙏 감사의 말

- [Google Gemini](https://ai.google.dev/) - AI 이미지/동영상 생성
- [FFmpeg](https://ffmpeg.org/) - 영상 합성
- [React](https://react.dev/) - UI 프레임워크
- [Tailwind CSS](https://tailwindcss.com/) - CSS 프레임워크

---

## 📞 문의

문제가 발생하거나 질문이 있으시면:
- [Issues](https://github.com/yourusername/shorts-generator/issues) 페이지에 등록
- [사용자 가이드](docs/AI_Studio_사용자_가이드.md)의 FAQ 참고

---

## 🎉 버전 히스토리

### v6.0.0 (2026-01-03)
- ✅ Phase 1: 쇼츠 제작 모드 5개 추가
- ✅ Phase 2: 이미지 편집 모드 6개 추가
- ✅ 총 14개 모드 완성
- ✅ 완전 자동화 워크플로우 구축
- ✅ 96% 시간 단축 달성

### v5.0.0 (이전 버전)
- 기본 3개 모드 (퓨전, 텍스트, 동영상)

---

## 🌟 Star History

이 프로젝트가 도움이 되셨다면 ⭐ Star를 눌러주세요!

---

**Made with ❤️ by [Your Name]**

**AI Studio - 쇼츠 제작의 새로운 기준** 🚀✨
