# ShortsLab Prompt Rules / Backup 작업 정리 (2026-01-23)

## 목적
- 쇼츠랩 장르 설정 모달 안에서 **이미지 프롬프트 규칙을 한곳에서 편집/백업/복구** 가능하게 구성.
- 장르 가이드라인과 프롬프트 규칙을 각각 관리.

---

## 신규/수정된 주요 기능

### 1) 장르 백업 (기존 요청 반영)
- 장르 가이드라인 백업/복구/이름 수정/내용 편집 지원
- 백업 최대 5개 유지 (초과 시 오래된 백업 자동 제거)

### 2) 프롬프트 규칙 관리 탭 추가
- 장르 모달 내 "프롬프트 규칙" 탭 추가
- JSON 직접 편집 후 저장 가능
- 규칙 백업/복구/이름 수정/내용 편집 지원
- 백업 최대 5개 유지

### 3) 쇼츠랩 프롬프트 생성 로직 연결
- `labPromptBuilder.ts`가 **규칙 파일 기반**으로 동작
- 다음 항목들이 규칙 JSON으로 제어됨:
  - START/FEMALE_BODY/MALE_BODY/END/NEGATIVE
  - noTextTag
  - enforceKoreanIdentity
  - expressionKeywords
  - cameraMapping
  - outfitSelection (allow/exclude/중복 허용)
  - promptSections(헤어/캐릭터/의상규칙/추가 룰)

---

## 추가된 파일

- `services/shortsLabPromptRulesDefaults.ts`
  - 프롬프트 규칙 기본값 정의
- `services/shortsLabPromptRulesManager.ts`
  - 프롬프트 규칙 저장/불러오기/백업/복구 로직
- `hooks/useShortsLabPromptRulesManager.ts`
  - 프롬프트 규칙 상태 관리 훅

---

## 수정된 파일

- `services/shortsLabGenreManager.ts`
  - 장르 백업 CRUD 추가
- `hooks/useShortsLabGenreManager.ts`
  - 장르 백업 상태/액션 추가
- `components/ShortsLabPanel.tsx`
  - 장르 모달: 백업 UI + 프롬프트 규칙 탭 + 백업 모달 추가
- `services/labPromptBuilder.ts`
  - 프롬프트 규칙을 단일 소스로 연결

---

## 프롬프트 규칙 JSON 핵심 키

```json
{
  "promptConstants": {
    "START": "...",
    "FEMALE_BODY": "...",
    "MALE_BODY": "...",
    "END": "...",
    "NEGATIVE": "..."
  },
  "noTextTag": "no text, no letters, ...",
  "enforceKoreanIdentity": true,
  "expressionKeywords": { "comedy-humor": { "hook": "..." }, "default": { "hook": "..." } },
  "cameraMapping": { "hook": { "angle": "close-up", "prompt": "..." } },
  "outfitSelection": {
    "femaleAllowList": [],
    "femaleExcludeList": [],
    "maleAllowList": [],
    "maleExcludeList": [],
    "allowDuplicateFemale": false
  },
  "promptSections": {
    "hairstyleSection": "...",
    "characterSection": "...",
    "outfitRulesSection": "...",
    "imagePromptRulesExtra": "..."
  }
}
```

---

## 사용 위치 (UI)
- 쇼츠랩 > 장르 설정 버튼 클릭
- 상단 탭에서 "프롬프트 규칙" 선택
- JSON 수정 후 저장
- 백업/복구/편집 가능

---

## 추가 요청 가능 항목
- JSON 대신 폼 UI로 편집
- 규칙을 파일로 저장/불러오기(export/import)
- 장르별 프롬프트 규칙 분리 저장
