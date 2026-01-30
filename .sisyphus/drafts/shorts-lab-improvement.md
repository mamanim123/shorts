# Draft: 쇼츠랩 2단계 생성 품질 고도화 (배경 가시성 및 공간감 강화)

## Requirements (confirmed)
- 장면 분할 지능화: 대본 생성 시 8~12개의 문장으로 명확히 분리되도록 프롬프트 강화. (완료됨)
- 인물/역할 배정 강화: '캐디' 키워드 시 WomanD 슬롯 강제 배정 및 역할별 슬롯 매핑 최적화. (완료됨)
- **추가 요구사항 (공간감 및 배경)**:
    - **배경 가시성 확보**: 증명사진처럼 인물만 크게 나오는 현상(Passport photo effect) 방지.
    - **공간감 강화**: 여기가 '골프장'임을 확실히 알 수 있도록 광활한 배경 묘사와 주변 지형물(페어웨이, 깃발, 산맥 등) 강조.
    - **초점 제어**: 와이드 샷에서 배경을 뭉개는 '보케(Bokeh)' 효과를 억제하고 전체적인 선명도(Deep focus) 확보.
    - **인물-배경 통합**: 인물을 단순히 배치하는 게 아니라, 지형과 상호작용하는 느낌(배경의 일부로 존재) 주입.

## Technical Decisions
- `manualSceneBuilder.ts`: 
    - `longPrompt` 구조 재설계: 카메라 앵글 바로 뒤에 배경(Background)을 먼저 배치하여 AI의 초기 포커스를 환경에 맞춤.
    - "Landscape Integration" 규칙 추가: 모든 프롬프트에 `environment context`와 `location identity` 필수 포함 지시.
- `ShortsLabPanel.tsx`: 
    - 와이드 샷일 때 `shallow depth of field`, `portrait focus` 관련 키워드를 강제로 삭제하는 필터 추가.
    - `panoramic`, `scenic backdrop`, `full environment visible` 키워드 주입 로직 강화.

## Research Findings
- 현재 프롬프트 조립 순서가 `[Person X]` 블록이 배경보다 앞에 있어 AI가 인물 묘사에 에너지를 다 쓰고 배경을 생략하는 경향 발견.
- `unfiltered raw photograph` 등 인물 부각용 기술 태그가 배경 가시성을 저해할 가능성 확인.

## Open Questions
- (없음 - 배경 실종 문제 해결을 최우선으로 함)

## Scope Boundaries
- INCLUDE: 배경 강조 프롬프트 구조 변경, 공간감 키워드 보강, 보케 억제 로직.
- EXCLUDE: 럭셔리 미학 (마마님 제외 요청 유지).
