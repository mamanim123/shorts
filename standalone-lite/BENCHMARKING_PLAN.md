# 📑 TubeFactory 고도화 기술 구현 계획서 (Technical Blueprint)

이 문서는 `tubefactory.kr`의 모든 기능을 분석하여 `standalone-lite` 프로젝트에 이식하기 위한 기술적 가이드를 담고 있습니다.

## 🔎 섹션별 벤치마킹 및 이식 전략

### 1. 캐릭터 디자인 (Character Consistency)
- **현재 상태**: 단일 레퍼런스 이미지 연동 가능.
- **고도화 계획**: 
    - 여러 명의 고정 캐릭터 슬롯 관리 (동생, 형 등 이름 지정).
    - 캐릭터별 상세 묘사(의상, 외모)를 프롬프트에 자동 주입하는 매크로 엔진.
    - 한국어 입력 -> AI 번역 -> 이미지 프롬프트 최적화 파이프라인.

### 2. 이미지 & 영상 생성 (Media Engine)
- **현재 상태**: 단일 생성 위주.
- **고도화 계획**:
    - 대본의 모든 씬(Scene)을 한 번의 클릭으로 일괄 생성하는 배치 시스템.
    - 생성된 이미지에 어울리는 영상 모델(Video Model) 자동 매칭 옵션.

### 3. 이미지 효과 (Dynamic Zoom/Pan)
- **현재 상태**: 정지 이미지 위주.
- **고도화 계획**:
    - `ffmpeg.wasm` 기술을 활용하여 브라우저에서 이미지에 줌인/줌아웃/패닝 효과를 적용.
    - "다이나믹 카메라" 옵션을 켜면 이미지 한 장이 5~10초의 역동적인 영상으로 변환.

### 4. 타임라인 편집 (Timeline Studio)
- **현재 상태**: 리스트 형태의 씬 관리.
- **고도화 계획**:
    - `wavesurfer.js`를 이용한 오디오 파형 시각화.
    - 보이스(TTS) 구간에 맞춰 이미지와 자막의 시점을 드래그 앤 드롭으로 조절.

### 5. 자막 스타일링 & SEO
- **현재 상태**: 기본 텍스트 표시.
- **고도화 계획**:
    - 애니메이션 자막 프리셋 (말하는 속도에 맞춰 글자가 강조되는 기능 등).
    - 유튜브 제목, 설명, 해시태그를 대본의 핵심 키워드를 기반으로 3가지 옵션으로 자동 생성.

---

## 🛠️ 적용 기술 (Tech Stack)

- **AI Logic**: Gemini 2.0 Flash (Text-to-Everything)
- **Audio Visual**: wavesurfer.js (Waveform), ffmpeg.wasm (Motion Engine)
- **Export Engine**: XML/JSON Generator (CapCut, Vrew 호환)
- **State Management**: Zustand (정밀 싱크 관리)

## 📅 향후 일정
1. **Phase 1**: 캐릭터 일관성 시스템 강화 및 자동 번역 프롬프트 브릿지.
2. **Phase 2**: 타임라인 편집기 초기 버전 (파형 시각화 & 기본 싱크).
3. **Phase 3**: 이미지 동적 효과(Motion) 및 영상 레이어 합성 엔진.

---
작성일: 2026-04-14
작성자: Antigravity AI (Pair Programmer)
