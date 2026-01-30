# [Plan] 쇼츠랩 2단계 생성 샷 품질 및 배경 가시성 고도화

## TL;DR

> **Quick Summary**: 인물만 부각되는 '증명사진 효과'를 차단하고, 골프장의 광활한 공간감과 배경이 선명하게 살아나도록 프롬프트 구조와 로직을 전면 개편합니다.
> 
> **Deliverables**: 
> - 배경 우선(Background-First) 구조가 적용된 장면 분해 프롬프트
> - 와이드 샷에서 배경 뭉개짐(Bokeh)을 방지하는 지능형 필터
> - 다인원 동작 다양성 및 캔디샷(Candid) 주입 로직 강화
> 
> **Estimated Effort**: Short
> **Parallel Execution**: YES
> **Critical Path**: 프롬프트 조립 순서 변경 → 배경 가시성 키워드 보강 → 통합 테스트

---

## Context

### Original Request
인물이 너무 크게 나와서 배경(골프장)이 전혀 보이지 않는 문제, 4/8번 동작 중복, 단조로운 앵글을 한꺼번에 해결해달라는 마마님의 요청.

### Interview Summary
**Key Discussions**:
- **배경 가시성**: 스튜디오가 아닌 '진짜 골프장' 필드 느낌이 나도록 광활한 공간감 묘사 강화.
- **포커스 제어**: 와이드/미디엄 샷에서 배경을 뭉개지 않고 선명하게 유지(Deep Focus).
- **프롬프트 구조**: AI의 시선을 환경에 먼저 머물게 한 뒤 인물을 배치하는 순서로 개편.
- **동작/앵글**: 다인원 동작 분리 및 미디엄샷 중복 방지.

---

## Work Objectives

### Core Objective
인물과 배경의 완벽한 조화를 달성하여, 한 눈에 '설산 골프장'임을 알 수 있는 시네마틱한 쇼츠 장면을 생성함.

### Concrete Deliverables
- `services/manualSceneBuilder.ts`: 배경 강조형(Environment-First) 프롬프트 템플릿 개편.
- `components/ShortsLabPanel.tsx`: 앵글별 배경 선명도 제어 및 공간감 키워드(`scenic backdrop`, `wide field of view`) 자동 주입 로직.

### Definition of Done
- [ ] 와이드 샷에서 인물의 전신과 주변 지형(페어웨이, 산맥 등)이 명확히 공존함.
- [ ] 프롬프트에서 `shallow depth of field` 키워드가 와이드 샷 시 자동으로 제거됨.
- [ ] 씬 조립 시 배경 묘사가 인물 정보(`[Person X]`)보다 우선 배치됨.
- [ ] 2단계 생성 시 미디엄샷 2회 연속 중복 소멸.

---

## TODOs

### Wave 1: 배경 중심 프롬프트 체계 개편

- [x] 1. 장면 분해 프롬프트(`manualSceneBuilder.ts`) 구조 혁신
  - **What to do**: 
    - "Background Visibility Rule" 추가: 배경을 먼저 설명하고 인물을 배치하도록 지시.
    - "No studio look" 가이드 추가: 인공 조명 느낌 배제 및 자연광/공간감 강조.
  - **References**: `services/manualSceneBuilder.ts`

- [x] 2. 프롬프트 조립기(`ShortsLabPanel.tsx`) 배경 우선 로직 적용
  - **What to do**: 
    - `composeManualPrompt`에서 `cameraPrompt` + `background`를 먼저 배치하고 그 뒤에 `identityBlock`을 붙이도록 조립 순서 변경.
    - 샷 타입이 'wide'일 때 배경 선명도 키워드(`deep focus`, `sharp background`) 강제 주입.
  - **References**: `components/ShortsLabPanel.tsx`

### Wave 2: 다양성 및 역동성 강화 (Candid)

- [x] 3. 앵글 및 포즈 로테이션 고도화
  - **What to do**: 
    - 미디엄샷 중복 차단 및 다인원 씬에서 `candid interaction` 키워드 주입 강화.
    - 인물별 개별 동작 부여(AI 지시문) 최종 확인.

---

## Success Criteria
- [ ] 골프장 배경이 전체 화면의 50% 이상을 차지하는 와이드 샷 확보.
- [ ] 배경이 뭉개지지 않고 산맥, 눈 덮인 필드가 선명하게 보임.
- [ ] 인물이 카메라를 의식하지 않는 자연스러운 동작 구사.
