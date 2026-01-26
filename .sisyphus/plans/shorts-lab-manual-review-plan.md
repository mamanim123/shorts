# [PLAN] 쇼츠랩 수동대본 기능 점검/개선

## 목표
- 수동대본만들기 기능의 목적(=AI 대본 생성의 이미지 프롬프트 품질만 재사용)과 실제 동작의 차이를 해소.
- 캐릭터 고정(의상/나이/악세) 입력 구조를 단순화하여 사용성 개선.
- 수동대본/대본→이미지 기능의 역할 구분을 명확히 함.

## 문제점 요약
- 수동대본 AI 프롬프트 규칙이 기존 AI 대본 생성 규칙 대비 약함(카메라/표정/씬 규칙).
- Identity Lock UI/옵션이 복잡하고 중복됨(사용자 판단 부담).
- AI 씬 분해 시 scriptLine 재해석 가능성(원문 그대로 사용 강제 부족).
- 슬롯/characterIds 매핑 규칙이 모호할 수 있음.
- “대본→이미지”와 수동대본 기능의 구분이 불명확.

## 체크리스트
- [x] 수동대본 AI 프롬프트에 카메라/표정/씬 규칙 강화(기존 로직 일부 재사용)
- [x] scriptBody/sceneLine 1:1 매칭 규칙을 강하게 강조(문장 원문 유지)
- [x] Identity Lock UI 간소화: 선택값만 반영, 불필요한 토글/옵션 제거
- [x] 슬롯/characterIds 매핑 규칙 명확화 및 누락 시 처리 정의
- [x] 수동대본 vs 대본→이미지 기능 역할 구분 설명/라벨 추가

## 작업 파일
- components/ShortsLabPanel.tsx
- components/ShortsIdentityCard.tsx
- services/labPromptBuilder.ts (필요 시 규칙 섹션 재사용)
