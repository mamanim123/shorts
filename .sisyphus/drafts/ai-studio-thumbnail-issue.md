# Draft: AI Studio 썸네일 무한 로딩 및 닫힘 현상 분석

## 현상 분석
- **증상 1**: AI Studio 내 '썸네일 스튜디오'의 우측 사이드바(이미지 히스토리)가 무한 로딩 상태.
- **증상 2**: 이 상태에서 사이드바 메뉴 클릭 시 AI Studio 창 전체가 닫힘.

## 원인 진단
### 1. ThumbnailStudio.tsx 무한 루프
- **코드 위치**: `F:\test\쇼츠대본생성기-v3.5.3\components\master-studio\studios\ThumbnailStudio.tsx` (91-100번 라인)
- **분석**:
  ```tsx
  useEffect(() => {
      const load = async () => {
          const urls = await resolveImageHistoryUrls(historyItems, historyImages);
          if (Object.keys(urls).length > 0) {
              createdUrlsRef.current.push(...Object.values(urls));
              setHistoryImages(prev => ({ ...prev, ...urls }));
          }
      };
      load();
  }, [historyItems, historyImages]);
  ```
  - `historyImages`가 의존성 배열에 포함되어 있는데, `setHistoryImages`를 통해 상태를 업데이트하고 있음.
  - `resolveImageHistoryUrls`는 `historyImages`에 없는 항목만 찾아서 반환하지만, 만약 반환된 `urls`가 빈 객체가 아니라면 상태가 업데이트되고, 다시 `useEffect`가 실행됨.
  - 특히 `historyItems`가 변경될 때마다 전체를 다시 검사하는 구조라 부하가 큼.
- **해결책**: 의존성 배열에서 `historyImages`를 제거하고, `historyItems`만 남기거나, 업데이트 로직을 최적화하여 중복 업데이트를 방지해야 함.

### 2. 창 닫힘 현상 (Event Bubbling)
- **코드 위치**: `MasterStudioContainer.tsx` 및 `Sidebar.tsx`
- **분석**: 
  - `MasterStudioContainer`는 `onClose` 프롭을 `Sidebar`에 전달함.
  - 사이드바 내의 클릭 이벤트가 `MasterStudioContainer`의 배경 클릭(overlay click)으로 오인되거나, 사이드바 메뉴 클릭 시 `onClose`가 잘못 호출되는 구조적 문제일 가능성.
  - 무한 루프로 인해 JS 메인 스레드가 차단된 상태에서 클릭 이벤트가 발생하면, 리액트의 상태 업데이트가 꼬이면서 예기치 않은 핸들러가 트리거될 수 있음.
- **해결책**: 사이드바 클릭 이벤트에 `e.stopPropagation()`을 추가하고, `onClose` 트리거 조건을 명확히 분리함.

### 3. LSP 에러 (setNotification)
- **코드 위치**: `ThumbnailStudio.tsx` (639번 라인)
- **분석**: `setNotification` 함수가 정의되지 않은 채 사용됨. 보통 `useNotification` 훅이나 상위에서 전달받은 프롭이어야 함.
- **해결책**: 누락된 훅이나 상태 정의를 추가함.

## 기술적 결정
- `ThumbnailStudio`의 `useEffect` 의존성을 `historyItems`의 ID 목록 등으로 최소화.
- `MasterStudioContainer`의 레이아웃 구조 검토 및 이벤트 전파 차단.
- 누락된 상태/함수 정의 보완.

## 테스트 전략
- `npm run dev` 실행 후 썸네일 스튜디오 진입 시 무한 루프 여부(콘솔 로그) 확인.
- 사이드바 메뉴 클릭 시 창 유지 여부 확인.
- 썸네일 이미지 히스토리가 정상적으로 로드되는지 확인.
- 에이전트 QA: Playwright를 사용하여 사이드바 클릭 시 창이 닫히지 않는지 자동화 테스트.

## 범위 경계
- 포함: AI Studio 썸네일 스튜디오 및 공통 사이드바 로직 수정.
- 제외: 타 스튜디오 모듈의 개별 기능.
