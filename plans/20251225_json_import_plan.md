## 작업 목표
- 마마님이 제공하신 단일 객체 JSON(`version/title/hook/context/outfit_selected/...`)도 앱에서 정상 가져올 수 있도록 가져오기 로직과 타입을 확장합니다.

## 구현 계획
1. **타입 확장**: `types.ts`에 `StoryResponse`와 `Scene`에 선택 필드(예: hook, context, cta, tags, hashtags, outfits/outfitSelected, accessories, scriptLine, lengthSec 등)를 추가해 새 JSON 구조를 안전하게 담을 수 있게 합니다.
2. **가져오기 로직 보강**: `App.tsx`의 `importStoryFromJson`에서 단일 객체 형태(`scripts` 배열 없이 version/title/hook/...가 바로 있는 경우)를 감지해 `StoryResponse`로 매핑합니다. script→scriptBody, twist→punchline, outfit_selected→outfitSelected/outfits, scriptLine 포함 씬 매핑 등 누락 없이 반영합니다.
3. **기본값·표시 안전성 검증**: 필수 누락 시 기본값 보완(예: id/createdAt/cta 기본 생성), 장면·태그·해시태그 길이 부족 시에도 파싱 실패 없이 저장되도록 처리하고 UI에서 기존 흐름이 깨지지 않는지 수동 점검합니다.

## 완료 기준
- 마마님이 제공한 JSON을 붙여 넣어도 오류 없이 히스토리에 추가되며 제목/본문/반전/씬 정보가 표시됩니다.
- 기존 `scripts` 배열 포맷도 그대로 동작합니다.
- 타입 확장으로 인해 빌드 에러가 없고, 필요한 기본값이 자동 채워집니다.
