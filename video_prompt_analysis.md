# 비디오 프롬프트 엔진 분석 및 고도화 계획

## 1. 현상 분석: Gemini가 영상을 직접 생성한 이유
현재 시스템에서 '비디오 프롬프트 재생성' 실행 시, Gemini가 텍스트 응답 대신 직접 영상을 생성하는 현상(Intent Hijacking)이 발생함.

### 원인 (Triggers)
1.  **시각적 정보의 과부하 (Visual Overload)**: `[VISUAL BASE]` 섹션의 `85mm lens`, `cinematic lighting` 등 전문적인 촬영 파라미터가 비디오 생성 모델(Veo)의 트리거로 작용.
2.  **페르소나의 영향**: `Professional Cinematographer` 설정이 "말로 설명하지 말고 결과물(영상)을 보여주라"는 암시로 해석됨.
3.  **부정 명령어(Negative Constraints) 실패**: "텍스트만 출력하라"는 부정 명령보다 앞선 긍정적 시각 묘사(눈밭, 인물 등)가 우선순위를 점유함.

## 2. 목표 (Goals)
'우연히 얻어걸린' 대박 영상을 시스템적으로 재현하고, 한국어 입 모양까지 구현하는 고도화된 엔진 구축.

### 핵심 목표
1.  **시네마틱 퀄리티 고정**: 조명, 렌즈, 질감 등 물리적 파라미터를 강제하여 항상 고화질 실사 영상 생성.
2.  **한국어 립싱크 구현**: 프롬프트 공학을 통해 한국어 발음 시의 구강 및 안면 근육 움직임을 유도.
3.  **이원화 모드 지원**: 텍스트 지시어가 필요할 때와 실제 영상 생성이 필요할 때를 명확히 구분하는 프롬프트 구조 설계.

## 3. 프롬프트 엔지니어링 전략 (V2 설계)

### A. 고화질 실사 (Cinematic Realism)
*   **Camera**: `Shot on 85mm prime lens at f/1.8` (심도 표현)
*   **Lighting**: `Volumetric rim lighting`, `Diffuse ambient occlusion` (입체적 조명)
*   **Texture**: `Micro-pores`, `Uncompressed raw texture` (미세 질감)

### B. 한국어 립싱크 (Korean Lip-Sync)
*   **Instruction**: `Synchronize mouth movement with Korean articulation` (한국어 조음 동기화)
*   **Detail**: `Exaggerated jaw/lip shapes for vowels`, `Tongue placement` (구체적 구강 움직임)

## 4. 체크리스트 (Checklist)

- [ ] **서버 로직 분석 완료**: `server/index.js`의 현재 프롬프트 구조 파악 완료.
- [ ] **V2 마스터 프롬프트 작성**: 
    - [ ] `[VIDEO GENERATION DIRECTIVE]` 섹션 신설
    - [ ] 시네마틱 파라미터(조명, 렌즈) 모듈화
    - [ ] 한국어 립싱크 지시어 모듈화
- [ ] **서버 코드 적용 (`server/index.js`)**:
    - [ ] `/api/video/refine-prompt` 엔드포인트 수정
    - [ ] 텍스트 전용 모드 vs 영상 생성 모드 분기 (선택 사항)
- [ ] **검증 (Verification)**:
    - [ ] 수정된 프롬프트로 Gemini가 고퀄리티 영상 생성하는지 확인
    - [ ] 한국어 대사 시 입 모양의 자연스러움 확인

## 5. 결론 및 제언
## 6. [중요] 세션 전환 및 작업 이어가기 가이드

**현재 상황**: 이전 대화 세션의 토큰 한계로 인해 새로운 세션으로 작업을 이관합니다. 본 파일은 이전 세션의 모든 분석 결과와 실행 계획을 담고 있습니다.

### 다음 세션에서 에이전트에게 지시할 내용 (복사해서 사용하세요)
새로운 세션이 시작되면 아래 내용을 에이전트에게 전달하여 즉시 작업을 재개할 수 있습니다.

> "지난 세션에서 `video_prompt_analysis.md` 파일을 통해 비디오 프롬프트 엔진 고도화 계획을 세웠어. 이 파일에 있는 **3. 프롬프트 엔지니어링 전략 (V2 설계)** 내용을 바탕으로, `server/index.js`의 `/api/video/refine-prompt` 엔드포인트를 수정해서 실제로 고퀄리티 영상과 한국어 립싱크가 가능한 프롬프트가 적용되도록 코드를 수정해줘. **체크리스트의 '서버 코드 적용' 단계부터 바로 시작하면 돼.**"

### 핵심 컨텍스트 요약 (이전 세션의 기억)
1.  **현상**: `Refine` 버튼 클릭 시 Gemini가 텍스트 대신 고퀄리티 영상을 직접 생성해버리는 현상 발견.
2.  **결정**: 이 '버그'를 수정하여 없애는 것이 아니라, **'초고화질 영상 자동 생성' 기능으로 승화**시키기로 결정함.
3.  **요구사항**:
    *   **화질**: 무조건 `85mm f/1.8`, `Cinematic lighting` 급의 실사로 고정.
    *   **립싱크**: 프롬프트에 입 모양(Articulation) 지시어를 넣어 "한국말을 하는 듯한" 영상을 만들 것.
    *   **대기 상태**: 분석만 끝났고, 실제 코드 수정(`server/index.js`)은 아직 안 함. **지금 바로 수정해야 함.**

---
**이 파일은 `C:\Users\123\.gemini\antigravity\brain\8cdae7fa-07f6-4fc1-9af6-3cb67fe55386\video_prompt_analysis.md`에 위치해 있습니다.**
