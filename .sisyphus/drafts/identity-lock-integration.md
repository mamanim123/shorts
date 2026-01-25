# Draft: 쇼츠랩 Identity Lock (Cineboard Style) 통합 계획

## 1. 개요
- **목표**: 쇼츠랩의 강력한 프롬프트 엔진과 씨네보드의 직관적인 Identity Lock UI를 결합.
- **참조**: `WORKLOG_GOALS_CHECKLIST.md`의 남은 요구사항 반영.

## 2. 핵심 요구사항 (마마님 지침)
- **UI 스타일**: 씨네보드(Cineboard)의 카드형 모달 인터페이스.
- **데이터 항목**: 이름, 나이, 캐릭터(슬롯), 의상, 악세서리.
- **프롬프트 로직**: 쇼츠랩 'AI 대본 생성' 버튼 클릭 시의 로직 그대로 사용.
  - 여성 캐릭터 표현: `stunning Korean woman`, `slim hourglass figure`, `full bust slim waist` 등 쇼츠랩 특유의 키워드 고수.
  - 슬롯 시스템: Woman A/B/C, Man A/B/C.

## 3. 기술적 구현 계획 (분석 결과)
- **프롬프트 엔진 연동**: `youtube-shorts-script-generator.tsx`의 `enforceKoreanIdentity`와 `enhanceScenePrompt` 로직을 Identity Lock 데이터와 연동.
- **Identity Lock 데이터 구조**: 
  ```typescript
  type CharacterIdentity = {
    slotId: string; // Woman A, B, C...
    name: string;
    age: string;
    outfit: string;
    accessories: string[];
    isLocked: boolean;
  };
  ```
- **씬 분해 연동**: 씬 분해 API 호출 시, 위에서 설정된 `CharacterIdentity` 정보를 프롬프트의 최우선 순위(Absolute Formula)로 삽입.

## 4. 체크리스트 (WORKLOG 기반)
- [ ] 씨네보드 스타일의 Identity Lock 모달 컴포넌트 제작
- [ ] Woman C 슬롯 추가 및 캐릭터 사전 정렬
- [ ] 의상 카테고리/악세서리 드롭다운 연동
- [ ] 쇼츠랩 프롬프트 빌더(`enhanceScenePrompt`)에 Identity Lock 데이터 주입 로직 추가
- [ ] AI 대본 생성 버튼 클릭 시의 여성 표현 방식(Slot Woman A 등) 유지 확인

## 5. 오픈 질문
- **악세서리 리스트**: "일반 악세서리 신규 리스트"에 포함될 구체적인 항목이 있으신가요? (예: 다이아몬드 시계, 실버 목걸이 등)
- **겨울 토글**: "겨울 악세서리 토글"이 켜졌을 때 프롬프트에 추가될 특정 키워드(예: 털목도리, 귀마개 등)가 정해져 있나요?

---
*마마님, 이 드래프트를 바탕으로 구체적인 작업 계획을 수립하겠습니다.*
