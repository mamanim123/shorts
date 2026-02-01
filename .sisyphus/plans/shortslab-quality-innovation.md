# 🎬 ShortsLab 2단계 생성 품질 혁신 계획 (Phase 2 Quality Innovation)

마마님의 "대박 쇼츠" 제작을 위해, 2단계 생성(대본 → 이미지 프롬프트)의 지능과 구성을 전면 개조합니다. 기계적인 매칭을 버리고 예술적 감각이 가미된 결과물을 목표로 합니다.

## 🎯 핵심 목표
1.  **씬 구성 유연화**: 1:1 매칭 타파 (대본 맥락에 따라 8~12씬 최적 재구성)
2.  **캐릭터 정체성 강화**: 캐디(WomanD)를 항상 20대로 고정 및 외형 정보 강제 주입
3.  **겨울 아이템 완벽 일관성**: 캐릭터당 중복되지 않는 방한용품 2개 고정 (Locked)
4.  **카메라 앵글의 역동성**: 미들샷 중독 탈출 및 클로즈업/전신/항공샷 강제 믹스

## 🛠️ 작업 내역

### 1. 2단계 프롬프트 규칙 개조 (`services/shortsLabStep2PromptRulesDefaults.ts`)
*   **Scene Count Rule**: `finalPrompt`의 "1:1 매칭" 문구를 삭제하고, "대본의 흐름을 8~12개의 시각적 장면으로 가장 임팩트 있게 재구성하라"는 지침으로 변경.
*   **Camera Diversity Rule**: 
    *   "미들샷(medium shot) 3회 연속 사용 금지"
    *   "항공샷(Aerial/Bird's eye) 최소 1회 포함"
    *   "전신샷(Full-body/Wide) 최소 3회 포함 (배경 강조용)"
    *   "POV(1인칭 시점) 1~2회 권장"
*   **Prompt Structure**: `Identity + Outfit + Accessories`가 매 씬마다 생략 없이 명시되도록 강력 경고 추가.

### 2. 캐릭터 맵 및 나이 고정 로직 보완 (`services/labPromptBuilder.ts`)
*   **WomanD Enforcement**: `getPromptConstants` 또는 캐릭터 생성 로직에서 `WomanD` 슬롯에 대해 `targetAge`와 상관없이 "stunning young Korean woman in her early 20s"를 강제 할당하도록 수정.
*   **Identity Builder**: 캐릭터의 전체 묘사 문구가 AI에 의해 요약되지 않도록, 프런트엔드 조립 시 `Character Map`의 정보를 강제로 Join하는 로직 보장.

### 3. 방한용품 할당 시스템 강화 (`components/ShortsLabPanel.tsx`)
*   **Unique Accessory Set**: `distributeUniqueWinterItems` 기능을 보완하여, 세션 시작 시 각 캐릭터별로 `Accessory A + Accessory B` 세트를 할당하고 이를 `autoCharacterMap`에 고정.
*   **Winter Lock**: 씬마다 악세서리가 랜덤하게 바뀌지 않도록, 2단계 생성 전 과정에서 동일한 `Accessories` 문자열을 사용하도록 수정.

## 🧪 검증 계획
1.  **2단계 생성 테스트**: 대본 입력 후 생성된 씬 개수가 문장 수와 다를 수 있음을 확인 (8~12개 사이).
2.  **인물 나이 확인**: 캐디 캐릭터의 프롬프트에 `20s`가 명확히 포함되어 있는지 확인.
3.  **악세서리 일관성 체크**: 모든 씬에서 각 인물이 동일한 2개의 방한용품을 유지하는지 대조.
4.  **앵글 다양성 분석**: 생성된 결과물 중 미들샷 비중이 줄어들고 다양한 앵글이 섞여 있는지 확인.

---

**Clearance Checklist:**
- [x] 12문장 고정 매칭 폐지 결정
- [x] 캐디 20대 강제 고정 확인
- [x] 겨울템 2개 세트 고정 로직 설계
- [x] 앵글 수치화 규칙 수립

**마마님, 설계가 완료되었습니다! 이제 `/start-work` 명령으로 이 위대한 개조 작업을 시작해 주세요. 🎬✨**
