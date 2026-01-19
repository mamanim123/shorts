# 이미지 프롬프트 가드레일 업데이트 가이드

마마님이 요청하신 “프롬프트 미리보기와 실제 요청이 다르다”, “필수 문구가 빠져도 생성된다”, “숏/롱 프롬프트 목적이 무색하다” 문제를 한 번에 해결한 작업 내역입니다. 최대한 초등학생도 이해할 수 있게 정리했어요.

---

## 1. 무엇이 문제였나요?

1. **미리보기와 실제 요청이 달랐어요.** 예전 `previewPrompt()` 함수가 남아서 “미리보기”가 다른 경로를 탈 수도 있었어요.
2. **검증이 너무 약했어요.** `Raw photo style`, `tight-fitting...`, 액세서리, `No male characters appear...` 같은 필수 문구가 빠져도 그대로 통과했습니다.
3. **숏/롱 프롬프트 목적이 흐려졌어요.** 후처리 로직이 둘을 구분하지 않아 숏이 너무 심플하거나, 롱이 럭셔리 태그를 빠뜨리기도 했습니다.

---

## 2. 어떻게 고쳤나요?

| 위치 | 변경 내용 |
| --- | --- |
| `services/geminiService.ts` | 낡은 `previewPrompt()` 함수를 제거해 **모든 경로가 `buildFinalPrompt()`만** 쓰도록 통합했습니다. |
| `services/promptValidator.ts` | 장면 검증에 **19개의 필수 태그**(Raw photo style, bodycon, photorealistic, No male characters 등)를 추가하고, 빠지면 `[VALIDATION REMINDER]`로 재생성하게 했습니다. |
| `youtube-shorts-script-generator.tsx` | `enhanceScenePrompt()`가 이제 `promptKind`(short/long)를 받아 **숏**은 정책 안전 문구를 자동 보강하고, **롱**은 마마님이 템플릿에 적어둔 문구 그대로 유지합니다. Accessories, Scene 번호, Two-shot 규칙은 똑같이 강제됩니다. |
| `docs/prompt_age_guideline.md` (기존) | 연령 전달 가이드는 그대로 두고, 이번 문서에서 **검증·숏롱 차이**만 별도로 설명합니다. |

---

## 3. 적용 후 어떻게 확인하나요?

1. 앱을 실행하고 `대본 + 이미지 프롬프트` 모드에서 아무 대본이나 생성합니다.
2. `프롬프트 미리보기` 버튼을 눌러 실제로 보낸 문자열을 확인합니다. (`buildFinalPrompt` 결과와 동일해야 해요!)
3. `받은대본.txt`에서 각 Scene의 longPrompt를 확인하면 아래 문구가 모두 붙어 있어야 합니다.
   - `Raw photo style`, `Highly detailed skin texture with visible pores`, `Candid facial expression`, `Subsurface scattering`
   - `tight-fitting premium tailored design`, `bodycon silhouette accentuating feminine curves`, `form-fitting elegant attire with body-conscious refinement`
   - `photorealistic, 8k resolution, cinematic lighting, masterpiece, professional photography, depth of field, no text, ... --ar 9:16`
   - 남성이 없다면 `No male characters appear in this scene.`가 꼭 뒤에 붙습니다.
4. 숏 프롬프트에는 “tasteful, policy-safe” 문구가 추가되어 플랫폼 안전선 안에서만 묘사하도록 고정됩니다.

---

## 4. 유지보수 팁

1. **템플릿을 수정했다면**  
   - `youtube-shorts-script-generator.tsx`의 기본 템플릿을 바꾸고, 같은 파일 내 `LONG_PROMPT_*_TAGS` 배열도 같이 업데이트하세요.  
   - `services/promptValidator.ts`의 `REQUIRED_*` 목록도 동일하게 맞춰야 검증이 통과합니다.

2. **필수 문구를 추가/삭제하고 싶다면**  
   - `services/promptValidator.ts`에 있는 `REQUIRED_REALISM_TAGS`, `REQUIRED_FIT_TAGS`, `REQUIRED_QUALITY_TAGS`, `ACCESSORY_REQUIREMENTS`를 수정하세요.  
   - 같은 키워드를 `enhanceScenePrompt`의 `LONG_PROMPT_*` 배열에도 넣어야 자동 보강이 동작합니다.

3. **재시도 횟수를 바꾸고 싶다면**  
   - `youtube-shorts-script-generator.tsx`의 `MAX_VALIDATION_RETRIES` 값을 조정하세요. 기본은 1회입니다.

4. **로컬 스토리지 템플릿 리셋 방법**  
   - 브라우저 콘솔에서 `localStorage.removeItem('shorts-generator-mode-templates-v6')` 실행 후 페이지를 새로고침하면 기본 템플릿이 다시 적용됩니다.

---

## 5. 빠르게 체크하는 법 (요약)

1. 프롬프트 미리보기를 열어 길고 복잡한 지침이 그대로 보이면 OK.
2. Scene마다 `Korean woman` + 액세서리 문구가 있는지 확인.
3. 남성이 없는 장면이면 `No male characters appear...`로 끝나야 함.
4. 숏 프롬프트에도 Raw photo style/photorealistic/no text 블록이 남아 있는지 확인.

이 문서만 보고도 “어디를 어떻게 손봤는지”와 “앞으로 어떻게 유지해야 하는지” 바로 이해할 수 있게 구성했습니다. 추가로 궁금한 점 있으면 언제든지 말씀 주세요, 마마님! 🙇‍♂️
