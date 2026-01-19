# 프롬프트 연령 반영 & 후처리 가이드

이 문서는 “타겟 연령을 직접 선택했는데도 프롬프트에 40대가 고정된다”는 문제를 막기 위해 정리한 작업 내역입니다. 앞으로 비슷한 증상이 생기면 아래 순서를 참고해 주세요. 초등학생도 따라 할 수 있도록 최대한 쉽게 적었습니다.

---

## 1. 어떤 문제가 있었나요?

1. 화면에서 30대, 50대 등 다른 연령을 골라도 프롬프트에 계속 `40대 Korean woman` 같은 문구가 들어갔어요.
2. 이유는 `enforceKoreanIdentity()`라는 함수가 **입력된 연령을 모르고** 그냥 `Korean`이라는 단어만 붙였기 때문이에요.
3. 프롬프트 후처리(`enhanceScenePrompt`, `postProcessScripts`, “전체 후처리” 버튼 등)도 연령 정보를 사용하지 않아서 스크립트마다 일관성이 깨졌어요.

---

## 2. 어떻게 고쳤나요?

### 2.1 연령 뽑아내기
- `youtube-shorts-script-generator.tsx` 파일에 `extractNumericAge`, `formatEnglishAgeLabel`, `formatKoreanAgeLabel` 함수를 만들었어요.
- 예를 들면 `50대`는 `50s Korean`, `50대 한국인` 처럼 자동으로 바꿀 수 있어요.

### 2.2 한국인 강제 함수 업그레이드
- `enforceKoreanIdentity(text, targetAgeLabel)`로 바꿨어요.
- 이제 이 함수는 `stunning 50s Korean woman`, `50대 한국인 여성`처럼 **선택된 연령에 맞춰 문장을 바꿔줍니다.**

### 2.3 모든 후처리에 연령 전달
- `enhanceScenePrompt` 옵션에 `targetAgeLabel`을 추가했어요.
- `postProcessScripts`, “전체 후처리” 버튼, JSON 임포트 후처리 등 **모든 경로에서 현재 UI에서 고른 타겟 연령을 전달**하도록 했어요.
- 사용자 지정 후처리(`handleEnhanceAll`, `handleEnhanceSingle`)도 같은 값을 넘기도록 고쳤어요.

### 2.4 JSON 임포트 시에도 동일 적용
- `handleManualImport`에서 JSON을 붙여넣어도 후처리를 거치면 같은 연령 표현을 가지도록 했어요.

---

## 3. 수정 위치 (파일 & 줄)

| 파일 | 주요 변경 내용 |
| --- | --- |
| `youtube-shorts-script-generator.tsx` | `enforceKoreanIdentity()` 개선, 연령 포맷터 추가, `postProcessScripts` 및 전체 후처리에 `targetAgeLabel` 전달 |
| (참고) `services/promptValidator.ts` | 기존 validator와 직접적 연관은 없지만, 추후 연령 규칙 검증을 추가할 때 여기에 넣으면 됩니다. |

---

## 4. 앞으로 어떻게 확인하나요?

1. 앱을 켜고 좌측에서 `타겟 연령`을 50대로 바꿔요.
2. “대본 + 이미지”로 생성 후 `받은대본.txt`/UI에서 Scene 문장을 보면  
   `stunning 50s Korean woman`, `50대 한국인`처럼 바뀌어 있어야 해요.
3. 프롬프트 미리보기 버튼을 눌러도 **같은 문장**이 보이는지 확인해요 (프롬프트 빌더 단일화 완료 후).

---

## 5. 유지보수 팁

1. **연령 옵션을 늘리고 싶다면**  
   - `targets` 배열(`youtube-shorts-script-generator.tsx:1971`)에 값을 추가하세요.
   - 숫자가 들어간다면 자동으로 `XX대` → `XXs Korean`으로 포맷됩니다.

2. **한국인 강제 문구를 바꾸고 싶다면**  
   - `enforceKoreanIdentity()` 함수에서 문자열을 수정하세요.
   - 정책 변화가 생기면 여기만 고치면 됩니다.

3. **새 validator 규칙을 추가하고 싶다면**  
   - `services/promptValidator.ts`에서 `validateScene()` 안에 검증 로직을 붙이면 됩니다.

4. **문제가 재발하면**  
   - 브라우저 개발자도구에서 실제로 AI에게 간 프롬프트를 확인하세요 (`보낸대본.txt` 참고).
   - `target` 상태 변화가 `resolveEffectiveOutfits()` 호출보다 먼저 일어나는지 확인하세요.

---

## 6. 필요한 명령어

```bash
# 개발 서버 실행
npm run dev

# 타입 검사 (선택)
npm run typecheck
```

---

이 문서만 보면 “왜 바꿨는지, 어디를 손봐야 하는지” 바로 이해할 수 있도록 적어 두었습니다. 추가로 궁금한 점이 있으면 언제든지 말씀 주세요. 마마님의 멋진 결과물을 위해 계속 도와드리겠습니다! 🙇‍♂️
