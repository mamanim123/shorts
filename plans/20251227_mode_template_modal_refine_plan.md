# 모드 템플릿 설정창 UI 개선 계획

1. **현행 비교 및 요구사항 확인**
   - `components/ModeTemplateSettingsModal.tsx`(현재 고정 전체화면, portal/drag 없음)와 `components/EngineSettingsModal.tsx`(portal + 드래그 가능한 카드) 구조를 비교한다.
   - 엔진 프롬프트 편집창과 동일한 상단 드래그, backdrop, createPortal 패턴을 모드 템플릿 설정창에도 적용하기로 한다.

2. **구조/스타일 리팩터링**
   - 모달 루트에 `createPortal`을 사용하고, `position/isDragging/dragOffset` 상태와 `onMouseDown/Move/Up` 핸들러를 추가한다.
   - 배경 블러/투명 overlay, 다크 테마 카드, 헤더/컨트롤 버튼 등 레이아웃을 엔진 모달과 동일한 톤으로 조정한다.
   - 드래그 시 입력 포커스 유지하도록 헤더 영역에서만 드래그를 시작하도록 방지 로직 반영한다.

3. **기존 기능 유지 및 테스트**
   - 탭/textarea/토큰 안내/저장·초기화·취소 동작이 그대로 작동하는지 확인하고, 버튼 위치를 새 디자인에 맞게 배치한다.
   - 수동 테스트: 설정 버튼 클릭 → 모달 열림/이동/저장/초기화/닫기를 확인한다.
