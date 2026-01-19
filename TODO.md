# 📋 쇼츠대본생성기-v5 투두리스트

> **프로젝트 개요**: AI 기반 유튜브 쇼츠 대본 및 이미지 프롬프트 자동 생성 웹 애플리케이션
> **버전**: v2.5.1
> **타겟 사용자**: 한국 40-70대 시니어층, 콘텐츠 크리에이터
> **최종 분석일**: 2025-12-31

---

## 🎯 프로그램 핵심 기능

### ✅ 구현 완료된 기능

#### 1. 대본 생성 시스템
- [x] V3 럭셔리 엔진 (고급스러운 쇼츠 대본 생성)
- [x] CO-STAR 최적화 프롬프트
- [x] 6개 시나리오 모드
  - 이중의미/오해
  - 반전/사이다
  - 블랙코미디/풍자
  - 부부농담/19금
  - 유머/썰
  - 참교육/말빨 배틀
- [x] 3가지 방언 지원 (표준어, 전라도, 경상도)
- [x] 5가지 의상 스타일 (글래머러스, 우아함, 캐주얼, 골프, 전문직)
- [x] 의상 커스터마이징 시스템 (100+ 의상 아이템)
- [x] 대박 모드 (Viral Mode)
- [x] 재생성 참고문구 활성화

#### 2. 멀티 AI 지원
- [x] Gemini (API 직접 연동)
- [x] ChatGPT (Puppeteer 웹 자동화)
- [x] Claude (Puppeteer 웹 자동화)
- [x] GenSpark (실험적 지원)
- [x] AI 서비스 선택 UI

#### 3. 이미지 생성 시스템
- [x] Imagen 4.0 통합
- [x] 장면별 이미지 프롬프트 자동 생성
- [x] Short/Long/Sora 프롬프트 분리
- [x] 실제 이미지 생성 (Gemini API)
- [x] IndexedDB + 로컬 저장소 병합
- [x] 이미지 히스토리 관리
- [x] 안전 필터 토글

#### 4. 템플릿 분석 기능
- [x] 기존 대본 AI 분석
- [x] 스타일 템플릿 추출 (구조, 톤, 훅, 반전 패턴)
- [x] 템플릿 저장/로드
- [x] 템플릿 기반 새 대본 생성
- [x] 즐겨찾기 필터
- [x] 수동 JSON 템플릿 적용

#### 5. 롱폼 콘텐츠
- [x] 주제 기반 챕터 생성
- [x] 챕터별 상세 본문 생성
- [x] 세션 저장/로드
- [x] 최종 스크립트 통합/복사

#### 6. 유튜브 연동
- [x] 유튜브 영상 검색
- [x] 조회수/구독자 데이터 분석
- [x] 바이럴 스코어 계산
- [x] 영상 기획안 자동 생성

#### 7. 히스토리 관리
- [x] 로컬 스토리지 저장
- [x] 서버 동기화 (debounce 1000ms)
- [x] 생성 대본 리스트 (가상화 최적화)
- [x] 분석 템플릿 리스트
- [x] 즐겨찾기 토글
- [x] 대본 삭제

#### 8. 고급 기능
- [x] 프롬프트 강화 시스템 (슬롯 기반)
- [x] 프롬프트 프리셋 관리
- [x] JSON Import (다중 포맷 지원)
- [x] Script-to-Image 모드
- [x] 캐릭터 일관성 유지
- [x] Master Studio (통합 UI)

#### 9. UI/UX
- [x] 다크/라이트 모드
- [x] 탭 기반 네비게이션
- [x] 실시간 로딩 인디케이터
- [x] 에러 메시지 표시
- [x] 복사/공유 기능
- [x] 반응형 레이아웃

---

## 📦 기술 스택

### Frontend
- **React**: 19.2.0
- **TypeScript**: 5.8.2
- **Vite**: 6.2.0
- **Tailwind CSS**: 내재 (CLI 클래스)
- **Lucide React**: 0.554.0 (아이콘)
- **React Markdown**: 10.1.0
- **React Window**: 2.2.3 (가상화)

### Backend
- **Node.js** + **Express**: 5.1.0
- **Puppeteer**: 24.31.0 (웹 자동화)
- **Puppeteer Extra**: 3.3.6 + Stealth Plugin 2.11.2
- **CORS**: 2.8.5
- **Dotenv**: 17.2.3

### AI Services
- **Google Gemini**: API 1.30.0
- **Imagen**: 4.0 (이미지 생성)
- **ChatGPT, Claude, GenSpark**: Puppeteer 자동화

---

## 🔧 개선 필요 사항

### ⚠️ 높은 우선순위

- [ ] **에러 핸들링 강화**
  - Puppeteer 타임아웃 처리 개선
  - AI 응답 파싱 실패 시 복구 로직
  - 네트워크 오류 재시도 메커니즘

- [ ] **성능 최적화**
  - 이미지 생성 속도 개선 (병렬 처리 고려)
  - 히스토리 로딩 지연 최소화
  - 대용량 데이터 렌더링 최적화
  - Puppeteer 이미지 전용 탭 분리(이중 세션)로 대본/이미지 동시 처리 및 사용자 입력 대기시간 단축

- [ ] **보안 강화**
  - API 키 관리 방식 개선 (.env.local → 서버 사이드)
  - NSFW 필터 정확도 향상
  - XSS/CSRF 방어 검증

- [ ] **테스트 코드 작성**
  - 유닛 테스트 (Jest + React Testing Library)
  - E2E 테스트 (Playwright)
  - API 통합 테스트

### 📌 중간 우선순위

- [ ] **UI/UX 개선**
  - 모바일 반응형 최적화
  - 접근성 (ARIA, 키보드 탐색)
  - 다크모드 색상 조정

- [ ] **기능 확장**
  - 프롬프트 버전 관리 시스템
  - 대본 비교 기능 (A/B 테스트)
  - 이미지 편집 기능 (크롭, 필터)
  - 대본 내보내기 (PDF, DOCX)
  - 대본별 이미지 아카이빙 + 이미지 클릭 시 해당 프롬프트 노출(메타데이터 저장/뷰어 UI)
  - AI Studio용 중앙 이미지 인덱스 구축 + 스토리/버전 메타데이터 관리(UI 연계)

- [ ] **데이터 관리**
  - 서버 기반 사용자 계정 시스템
  - 클라우드 동기화 (Google Drive, Dropbox)
  - 대본 태그 및 카테고리 시스템

### 🔍 낮은 우선순위

- [ ] **분석 및 통계**
  - 생성 대본 성과 추적
  - 인기 템플릿 순위
  - 사용 패턴 분석 대시보드

- [ ] **협업 기능**
  - 대본 공유 링크 생성
  - 팀 워크스페이스
  - 댓글 및 피드백 시스템

- [ ] **추가 AI 서비스**
  - Midjourney API 연동
  - DALL-E 3 통합
  - 커스텀 AI 모델 학습

---

## 🚀 향후 계획

### Phase 1: 안정화 (1-2개월)
1. 에러 핸들링 및 로깅 시스템 구축
2. 테스트 코드 작성 (커버리지 70% 이상)
3. 성능 프로파일링 및 최적화
4. 보안 취약점 점검 및 패치

### Phase 2: 기능 확장 (2-3개월)
1. 사용자 계정 시스템 구현
2. 클라우드 동기화 기능
3. 대본 비교 및 A/B 테스트 기능
4. 모바일 앱 개발 시작 (React Native)

### Phase 3: 고도화 (3-6개월)
1. AI 모델 파인튜닝 (한국어 특화)
2. 실시간 협업 기능
3. 성과 추적 및 분석 대시보드
4. 프리미엄 기능 (유료 플랜)

---

## 📂 주요 파일 구조

```
쇼츠대본생성기-v5/
├── App.tsx                      # 메인 컴포넌트 (1478줄)
├── components/                  # 16개 UI 컴포넌트
│   ├── ConfigPanel.tsx          # 설정 입력
│   ├── OutputDisplay.tsx        # 결과 표시
│   ├── HistoryPanel.tsx         # 히스토리
│   ├── LongformPanel.tsx        # 롱폼 생성
│   ├── TemplatePanel.tsx        # 템플릿 UI
│   └── ...
├── services/                    # 9개 비즈니스 로직
│   ├── geminiService.ts         # AI 요청/응답
│   ├── promptBuilder.ts         # 프롬프트 빌드
│   ├── templateService.ts       # 템플릿 분석
│   └── ...
├── server/                      # Node.js 백엔드
│   ├── index.js                 # Express 서버 (1301줄)
│   ├── puppeteerHandler.js      # 웹 자동화
│   └── ...
├── utils/                       # 유틸리티
├── hooks/                       # React Hooks
└── generated_scripts/           # 생성 결과 저장
```

---

## 💡 개발 시 참고사항

### 주요 의존성
- Gemini API 키: `.env.local`의 `VITE_GEMINI_API_KEY`
- 포트: 3001 (백엔드), 3000 (프론트엔드)
- 브라우저: Chrome (Puppeteer)

### 실행 방법
```bash
# 개발 모드 (서버 + Vite 동시 실행)
npm run dev

# 서버만 실행
npm run server

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

### 데이터 저장 위치
- 로컬 스토리지: `shorts-story-engine-history`
- 파일 시스템: `generated_scripts/`, `style_templates/`, `longform_sessions/`
- IndexedDB: 이미지 캐시

### 주요 API 엔드포인트
- `POST /api/generate` - 대본 생성
- `GET/POST /api/history` - 히스토리 관리
- `GET/POST /api/templates` - 템플릿 관리
- `POST /api/generate/raw` - Raw AI 응답

---

## 🎓 기술 문서

### 아키텍처 패턴
- **프론트엔드**: Component-Based Architecture (React)
- **백엔드**: RESTful API (Express)
- **상태 관리**: React Hooks (useState, useEffect, useCallback)
- **데이터 흐름**: Unidirectional Data Flow

### 코드 컨벤션
- TypeScript Strict Mode
- ESLint + Prettier
- 컴포넌트 파일명: PascalCase
- 유틸리티 파일명: camelCase
- CSS: Tailwind Utility Classes

### 프롬프트 엔지니어링
- CO-STAR 프레임워크 사용
- 시스템 프롬프트: `constants.ts`의 `SYSTEM_PROMPT_V3_COSTAR`
- 사용자 프롬프트: `promptBuilder.ts`에서 동적 구성
- 슬롯 기반 동적 주입 ({{characterIds}}, {{outfits}} 등)

---

## 📞 문의 및 지원

### 기술 지원
- GitHub Issues: (프로젝트 저장소)
- 이메일: (담당자 이메일)

### 문서
- README.md: 프로젝트 개요
- API.md: API 문서 (작성 필요)
- CONTRIBUTING.md: 기여 가이드 (작성 필요)

---

## 📝 변경 이력

### v2.5.1 (현재)
- V3 럭셔리 엔진 안정화
- 이미지 생성 IndexedDB 병합
- 템플릿 시스템 고도화
- 유튜브 검색 기능 추가

### v2.5.0
- 롱폼 콘텐츠 생성 기능
- Master Studio UI 통합
- 프롬프트 프리셋 관리

### v2.4.0
- Imagen 4.0 통합
- 멀티 AI 지원 (ChatGPT, Claude)
- 템플릿 분석 기능

---

**마지막 업데이트**: 2025-12-31
**담당자**: (프로젝트 담당자 이름)
**상태**: 🟢 활성 개발 중
