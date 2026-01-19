# 🎯 대본별 이미지 폴더 관리 시스템 구현 계획

> **프로젝트**: 쇼츠대본생성기 v5.2 - 이미지 아카이빙 시스템
> **목표**: 대본별 이미지 폴더 자동 관리 + 히스토리 필터링
> **시작일**: 2026-01-01
> **상태**: 🔄 진행 중

---

## 📊 프로젝트 개요

### 🎯 핵심 목표
1. ✅ **대본별 폴더 생성**: 새 대본 생성 시 자동으로 `{storyId}` 폴더 생성
2. ✅ **이미지 자동 정리**: 프롬프트로 생성된 이미지를 해당 대본 폴더에 저장
3. ✅ **히스토리 필터링**: 대본 선택 시 해당 대본의 이미지만 사이드바에 표시
4. ✅ **메타데이터 관리**: 이미지에 프롬프트, 장면번호, 생성일시 등 정보 저장

### 🔄 현재 vs 개선 후

| 항목 | 현재 | 개선 후 |
|------|------|---------|
| **저장 위치** | `generated_scripts/images/*.png` (한 폴더에 모두) | `generated_scripts/images/{storyId}/*.png` (대본별 분리) |
| **파일명** | `{timestamp}_{prompt}.png` | `scene_{sceneNumber}_{timestamp}_{prompt}.png` |
| **히스토리** | 모든 이미지 표시 | 선택한 대본의 이미지만 표시 |
| **메타데이터** | 프롬프트만 저장 | storyId, sceneNumber, 생성일시, 모델명 저장 |

---

## 📋 상세 구현 계획

### ✅ Phase 1: 데이터 구조 설계 (30분)

#### 1.1 타입 정의 수정
- [ ] **파일**: `types.ts`
- [ ] ImageHistoryItem 인터페이스에 필드 추가
  ```typescript
  export interface ImageHistoryItem {
    id: string;
    prompt: string;
    generatedImageId: string;
    storyId?: string;           // ✅ 추가: 어느 대본에 속하는지
    sceneNumber?: number;       // ✅ 추가: 어느 장면인지
    localFilename?: string;
    favorite?: boolean;
    createdAt?: number;
    settings: ImageGenerationSettings;
  }
  ```

#### 1.2 폴더 구조 설계
- [ ] **목표 구조**:
  ```
  generated_scripts/
    └── images/
        ├── {storyId_1}/          ← 대본별 폴더
        │   ├── scene_1_xxx.png
        │   ├── scene_2_xxx.png
        │   └── scene_3_xxx.png
        ├── {storyId_2}/
        │   └── ...
        └── orphaned/              ← storyId 없는 이미지 (기존 호환)
  ```

**진행 상황**: ⬜ 미착수 | 🔄 진행중 | ✅ 완료
**담당자**: -
**예상 소요**: 30분
**실제 소요**: -

---

### ✅ Phase 2: 백엔드 수정 (1-2시간)

#### 2.1 서버 API 수정
- [ ] **파일**: `server/index.js`
- [ ] `/api/save-image` 엔드포인트 수정
  - [ ] `storyId`, `sceneNumber` 파라미터 추가
  - [ ] 대본별 폴더 자동 생성 로직
  - [ ] 파일명에 장면 번호 포함
  - [ ] 상대 경로 반환 (`{storyId}/{filename}`)

  ```javascript
  app.post('/api/save-image', (req, res) => {
    const { imageData, prompt, storyId, sceneNumber } = req.body;

    // ✅ 대본별 폴더 결정
    const targetDir = storyId
      ? path.join(IMAGES_DIR, storyId)
      : path.join(IMAGES_DIR, 'orphaned');

    // ✅ 폴더 생성
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // ✅ 파일명 생성
    const scenePrefix = sceneNumber ? `scene_${sceneNumber}_` : '';
    const filename = `${scenePrefix}${timestamp}_${safePrompt}.png`;
    // ...
  });
  ```

#### 2.2 새 API 추가
- [ ] **파일**: `server/index.js`
- [ ] `/api/images/by-story/:storyId` 엔드포인트 추가
  - [ ] 특정 대본의 이미지 목록 조회
  - [ ] 최신순 정렬
  - [ ] 상대 경로 반환

  ```javascript
  app.get('/api/images/by-story/:storyId', (req, res) => {
    const { storyId } = req.params;
    const storyDir = path.join(IMAGES_DIR, storyId);

    if (!fs.existsSync(storyDir)) return res.json([]);

    const files = fs.readdirSync(storyDir)
      .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
      .sort(/* 최신순 */)
      .map(f => `${storyId}/${f}`);

    res.json(files);
  });
  ```

#### 2.3 삭제 API 수정
- [ ] **파일**: `server/index.js`
- [ ] `/api/delete-file` 수정
  - [ ] 폴더 경로 포함 파일명 처리
  - [ ] 빈 폴더 자동 삭제 로직

**진행 상황**: ⬜ 미착수 | 🔄 진행중 | ✅ 완료
**담당자**: -
**예상 소요**: 1-2시간
**실제 소요**: -

---

### ✅ Phase 3: 프론트엔드 핵심 수정 (2-3시간)

#### 3.1 서비스 계층 수정
- [ ] **파일**: `components/master-studio/services/serverService.ts`
- [ ] `saveImageToDisk` 함수 시그니처 변경
  ```typescript
  export const saveImageToDisk = async (
    imageData: string,
    prompt: string,
    storyId?: string,      // ✅ 추가
    sceneNumber?: number   // ✅ 추가
  ): Promise<string> => {
    // ... storyId, sceneNumber 전달
  };
  ```

#### 3.2 OutputDisplay 컴포넌트 수정
- [ ] **파일**: `components/OutputDisplay.tsx`
- [ ] `handleGenerateImage` 함수 수정
  - [ ] saveImageToDisk 호출 시 storyId, sceneNumber 전달
  - [ ] ImageHistoryItem에 메타데이터 포함

  ```typescript
  const savedLocalFilename = await saveImageToDisk(
    base64Image,
    prompt,
    data.id,      // ✅ storyId
    sceneNumber   // ✅ sceneNumber
  );

  const newItem: ImageHistoryItem = {
    id: crypto.randomUUID(),
    prompt: prompt,
    generatedImageId: imageId,
    storyId: data.id,           // ✅ 추가
    sceneNumber: sceneNumber,   // ✅ 추가
    // ...
  };
  ```

#### 3.3 히스토리 필터링 로직
- [ ] **파일**: `components/OutputDisplay.tsx`
- [ ] `filteredHistory` useMemo 추가
  ```typescript
  const filteredHistory = useMemo(() => {
    return imageHistory
      .filter(item => item.storyId === data.id)  // ✅ 현재 대본만
      .sort(/* 즐겨찾기 > 최신순 */);
  }, [imageHistory, showFavoritesOnly, data.id]);
  ```

- [ ] 렌더링 부분 수정
  - [ ] `orderedHistory` → `filteredHistory` 변경

#### 3.4 이미지 로딩 로직 수정
- [ ] **파일**: `components/OutputDisplay.tsx`
- [ ] `loadHistoryImages` 함수 수정
  - [ ] 폴더 경로 포함 파일명 처리
  - [ ] `/generated_scripts/images/{storyId}/{filename}` 형식 지원

**진행 상황**: ⬜ 미착수 | 🔄 진행중 | ✅ 완료
**담당자**: -
**예상 소요**: 2-3시간
**실제 소요**: -

---

### ✅ Phase 4: 호환성 & 마이그레이션 (1시간)

#### 4.1 기존 이미지 마이그레이션
- [ ] **옵션 선택**:
  - [ ] 자동 마이그레이션: 기존 이미지를 `orphaned/` 폴더로 이동
  - [ ] 수동 처리: 기존 이미지는 그대로, 새 이미지만 폴더 구조 적용

#### 4.2 히스토리 호환성
- [ ] **파일**: `components/OutputDisplay.tsx`
- [ ] localStorage 마이그레이션 로직
  ```typescript
  const migrateHistory = () => {
    const history = JSON.parse(localStorage.getItem('imageHistory') || '[]');

    const migrated = history.map(item => ({
      ...item,
      storyId: item.storyId || null  // null이면 orphaned
    }));

    localStorage.setItem('imageHistory', JSON.stringify(migrated));
  };
  ```

**진행 상황**: ⬜ 미착수 | 🔄 진행중 | ✅ 완료
**담당자**: -
**예상 소요**: 1시간
**실제 소요**: -

---

### 🆕 Phase 5: 추가 기능 (선택, 2-3시간)

#### 5.1 Lightbox 메타데이터 표시
- [ ] **파일**: `components/master-studio/Lightbox.tsx`
- [ ] 프롬프트 표시 영역 추가
- [ ] 장면 번호 배지 추가
- [ ] 생성 일시 표시
- [ ] 사용된 모델명 표시

#### 5.2 버튼 분리 (저장 vs 생성)
- [ ] **파일**: `components/OutputDisplay.tsx`
- [ ] "🎨 새로 생성" 버튼: AI 서비스로 프롬프트 전송
- [ ] "💾 기존 저장" 버튼: 이미 생성된 이미지만 다운로드
- [ ] 버튼 상태 관리 분리

#### 5.3 중앙 이미지 갤러리
- [ ] **파일**: `components/ImageGalleryPanel.tsx` (신규)
- [ ] 모든 대본의 이미지를 한 눈에
- [ ] 대본별 그룹핑 뷰
- [ ] 검색/필터링 기능
- [ ] Masonry Grid 레이아웃

#### 5.4 대본 삭제 시 이미지 폴더 삭제
- [ ] **파일**: `server/index.js`
- [ ] `/api/images/delete-folder/:storyId` 엔드포인트 추가
- [ ] **파일**: `components/HistoryPanel.tsx`
- [ ] 대본 삭제 시 이미지 폴더도 함께 삭제

#### 5.5 이미지 개수 표시
- [ ] **파일**: `components/HistoryPanel.tsx`
- [ ] 각 대본 카드에 이미지 개수 배지 추가

**진행 상황**: ⬜ 미착수 | 🔄 진행중 | ✅ 완료
**담당자**: -
**예상 소요**: 2-3시간
**실제 소요**: -

---

## 📊 전체 진행 상황

### 🎯 Phase별 완료율

| Phase | 작업 내용 | 상태 | 진행률 | 예상 시간 | 실제 시간 |
|-------|----------|------|--------|----------|----------|
| Phase 1 | 데이터 구조 설계 | ⬜ 미착수 | 0% | 30분 | - |
| Phase 2 | 백엔드 수정 | ⬜ 미착수 | 0% | 1-2시간 | - |
| Phase 3 | 프론트엔드 핵심 | ⬜ 미착수 | 0% | 2-3시간 | - |
| Phase 4 | 호환성 & 마이그레이션 | ⬜ 미착수 | 0% | 1시간 | - |
| Phase 5 | 추가 기능 (선택) | ⬜ 미착수 | 0% | 2-3시간 | - |

### 📈 전체 진행률
```
[□□□□□□□□□□] 0% (0/25 작업 완료)
```

**예상 총 소요 시간**: 6-9시간 (핵심 기능만: 4-6시간)
**실제 총 소요 시간**: -
**시작일**: -
**완료 예정일**: -

---

## 🧪 테스트 계획

### ✅ 단위 테스트

#### 백엔드
- [ ] `/api/save-image` 엔드포인트 테스트
  - [ ] storyId 있을 때 폴더 생성 확인
  - [ ] storyId 없을 때 orphaned 폴더 사용 확인
  - [ ] 파일명에 sceneNumber 포함 확인
  - [ ] 상대 경로 반환 확인

- [ ] `/api/images/by-story/:storyId` 엔드포인트 테스트
  - [ ] 존재하는 storyId 조회
  - [ ] 존재하지 않는 storyId 조회 (빈 배열 반환)
  - [ ] 정렬 순서 확인

#### 프론트엔드
- [ ] `filteredHistory` 로직 테스트
  - [ ] 현재 대본 이미지만 필터링 확인
  - [ ] 다른 대본 선택 시 히스토리 변경 확인
  - [ ] 즐겨찾기 필터 동작 확인

### ✅ 통합 테스트

#### 시나리오 1: 새 대본 생성 + 이미지 생성
1. [ ] 새 대본 생성
2. [ ] "생성" 버튼으로 이미지 생성
3. [ ] `generated_scripts/images/{storyId}/` 폴더 생성 확인
4. [ ] 이미지 파일 저장 확인
5. [ ] 히스토리에 이미지 표시 확인
6. [ ] 메타데이터 (storyId, sceneNumber) 저장 확인

#### 시나리오 2: 대본 전환
1. [ ] 대본 A 선택 → 대본 A 이미지만 사이드바에 표시
2. [ ] 대본 B 선택 → 대본 B 이미지만 사이드바에 표시
3. [ ] 대본 A로 복귀 → 대본 A 이미지 다시 표시

#### 시나리오 3: 기존 이미지 호환성
1. [ ] 기존 localStorage 데이터 로드
2. [ ] storyId 없는 이미지 처리 확인
3. [ ] orphaned 폴더 접근 확인

#### 시나리오 4: 이미지 삭제
1. [ ] 이미지 삭제
2. [ ] 파일 시스템에서 삭제 확인
3. [ ] 히스토리에서 제거 확인
4. [ ] 빈 폴더 정리 확인 (선택)

### ✅ 성능 테스트
- [ ] 대본 10개, 이미지 100개 시나리오
  - [ ] 히스토리 필터링 속도 (<100ms)
  - [ ] 이미지 로딩 속도 측정
  - [ ] 메모리 사용량 확인

---

## ✅ 완료 기준

### 필수 기능
- [ ] 대본 생성 시 자동으로 폴더 생성
- [ ] 이미지 생성 시 대본 폴더에 저장
- [ ] 대본 선택 시 해당 이미지만 사이드바 표시
- [ ] 장면 번호별 이미지 파일명 정렬
- [ ] 기존 이미지와 호환성 유지

### 선택 기능
- [ ] Lightbox에서 메타데이터 표시
- [ ] 버튼 분리 (생성 vs 저장)
- [ ] 중앙 이미지 갤러리
- [ ] 대본 삭제 시 이미지 폴더 삭제
- [ ] 이미지 개수 배지

### 품질 기준
- [ ] 모든 단위 테스트 통과
- [ ] 모든 통합 테스트 시나리오 통과
- [ ] 성능 기준 충족
- [ ] 코드 리뷰 완료
- [ ] 사용자 테스트 완료

---

## 📝 개발 노트

### 2026-01-01
- 프로젝트 계획 수립
- TODO.md, PLAN.md 검토
- 마마님 아이디어 통합

### 작업 로그
```
날짜       | 작업 내용                | 소요 시간 | 담당자
---------- | ----------------------- | -------- | ------
2026-01-01 | 계획 수립                | 1시간    | Claude
           |                         |          |
```

---

## 🚨 이슈 및 해결 방법

### 예상 이슈

#### 이슈 #1: 기존 이미지 파일 경로 불일치
- **문제**: localStorage에 저장된 경로가 새 구조와 맞지 않음
- **해결**: 마이그레이션 로직으로 자동 변환 또는 orphaned 폴더 활용

#### 이슈 #2: 폴더 삭제 시 OS 권한 문제
- **문제**: Windows에서 폴더 삭제 실패 가능
- **해결**: try-catch로 감싸고 에러 로깅, 사용자에게 수동 삭제 안내

#### 이슈 #3: 이미지 로딩 성능 저하
- **문제**: 대본별 폴더로 나뉘면서 로딩 경로 복잡해짐
- **해결**:
  - 로드 지연 (Lazy Loading)
  - 썸네일 캐싱
  - IndexedDB 활용

### 해결된 이슈
```
날짜 | 이슈 | 해결 방법 | 담당자
---- | ---- | -------- | ------
     |      |          |
```

---

## 📚 참고 자료

### 관련 문서
- [TODO.md](./TODO.md) - 전체 프로젝트 투두리스트
- [PLAN.md](./PLAN.md) - 최근 작업 계획
- [IMAGE_SYSTEM_IMPROVEMENT_PLAN.md](./IMAGE_SYSTEM_IMPROVEMENT_PLAN.md) - 기존 이미지 시스템 개선안

### 주요 파일
- `types.ts` - 타입 정의
- `server/index.js` - 백엔드 API
- `components/OutputDisplay.tsx` - 이미지 표시 UI
- `components/master-studio/services/serverService.ts` - 서버 통신

### 기술 스택
- **Backend**: Node.js + Express
- **Frontend**: React + TypeScript
- **Storage**: IndexedDB + LocalStorage + File System
- **이미지 생성**: Google Imagen 4.0

---

## 🎯 다음 액션 아이템

### 🔥 긴급 (오늘 착수)
1. [ ] Phase 1 시작: `types.ts` 수정
2. [ ] 백엔드 API 설계 최종 검토

### 📌 중요 (이번 주)
1. [ ] Phase 2 완료: 백엔드 수정
2. [ ] Phase 3 시작: 프론트엔드 수정

### 💡 나중에 (선택)
1. [ ] Phase 5: 추가 기능 구현
2. [ ] 중앙 이미지 갤러리 UI 설계

---

**최종 업데이트**: 2026-01-01
**다음 리뷰 예정**: -
**프로젝트 상태**: 🔄 계획 완료, 구현 대기
