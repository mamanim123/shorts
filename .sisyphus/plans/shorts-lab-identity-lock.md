# [PLAN] 쇼츠랩 Identity Lock 통합 및 UI 개선 계획

## 1. 목표
- 쇼츠랩(`youtube-shorts-script-generator.tsx`)에 씨네보드 스타일의 **인물 설정 카드(Identity Lock)** 도입.
- 쇼츠랩의 기존 **여성 캐릭터 표현 로직**과 **슬롯 시스템**을 카드 UI와 1:1 대응.
- 설정된 데이터(이름, 나이, 슬롯, 의상, 악세서리)가 씬 분해 프롬프트에 자동 반영되도록 연동.

## 2. 핵심 수정 범위 (Only Related)
- **UI**: 쇼츠랩 상단 또는 씬 분해 전 단계에 **'Identity Lock' 패널** 추가.
- **State**: 인물별 고정 데이터(`CharacterIdentity`) 상태 관리 로직 추가.
- **Logic**: `enhanceScenePrompt` 함수가 설정된 Identity 데이터를 최우선으로 사용하도록 수정.

## 3. 프롬프트 절대 공식 (유지 항목)
- `Slot Woman A`: `Long soft-wave hairstyle, voluptuous hourglass figure`
- `Slot Woman B`: `Short chic bob cut, petite and alluring aura`
- `Slot Woman C`: `Low ponytail, athletic and calm demeanor`
- `enforceKoreanIdentity`: 한국인 정체성 및 나이(in her {age}) 삽입 로직 유지.
- `Absolute Formula`: 씬 번호와 정체성을 맨 앞에 배치하는 규칙 고수.

## 4. 상세 단계 (Checklist)
- [ ] `ShortsIdentityCard` 컴포넌트 제작 (Cineboard 스타일 그리드 레이아웃)
- [ ] 인물 자동 분석 결과와 카드 UI 연동 로직 구현
- [ ] 슬롯 선택 시 해당 슬롯의 비주얼 프롬프트(hourglass 등) 자동 로드
- [ ] [이름, 나이, 의상, 악세서리] 입력값이 `enhanceScenePrompt`에 낚이도록 mapping 로직 수정
- [ ] 자물쇠(Lock) 활성화 시 해당 인물이 등장하는 모든 씬에 설정값 강제 주입

---
**주의**: 기존 대본 생성 엔진 및 파일 저장 시스템은 절대 수정하지 않음.
