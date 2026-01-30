# Draft: Grok Video Generation Integration

## Requirements (confirmed)
- 마마님께서 쇼츠랩(Cineboard) 미리보기의 각 프롬프트 비디오 탭에서 그록(Grok)을 이용한 영상 생성을 원하심.
- 현재는 Google VideoFX(Veo) 기반의 'generate-smart' 엔진이 연동되어 있음.

## Technical Decisions
- **엔진 선택제 도입**: 비디오 탭 내에서 'VideoFX'와 'Grok' 엔진 중 선택할 수 있는 UI 추가.
- **백엔드 라우트 추가**: `api/video/generate-grok` 엔드포인트 신설 또는 `generate-smart`에서 엔진 파라미터 처리.
- **API 연동**: xAI 직접 연동이 어려울 경우, 'fal.ai' 등 Grok Imagine Video API를 제공하는 서드파티 서비스 활용 권장.

## Research Findings
- `CineboardPanel.tsx`에서 `handleGenerateSceneVideo`가 `api/video/generate-smart`를 호출하고 있음.
- `puppeteerHandler.js`에 `VIDEOFX` 설정이 있으며, Google Flow를 자동화하는 방식임.
- Grok Imagine Video는 텍스트/이미지를 고품질 영상으로 변환하며, fal.ai에서 Node.js SDK 및 API 제공 중.

## Open Questions
- 마마님, Grok 영상 생성을 위해 **fal.ai**나 **kie.ai** 같은 서비스의 API 키를 사용하실 계획인가요? (xAI 공식 API는 아직 비디오를 대중적으로 열지 않았을 수 있습니다.)
- Grok으로 생성할 때 영상의 길이(초)나 스타일(시네마틱 등)에 대해 특별히 원하시는 설정이 있으신가요?
- 기존처럼 이미지를 먼저 생성하고 그 이미지를 Grok에 넣어 영상을 만드실 건가요, 아니면 텍스트만으로 바로 영상을 만드실 건가요?

## Scope Boundaries
- INCLUDE: `CineboardPanel.tsx` 비디오 탭에 Grok 엔진 선택 및 생성 버튼 추가.
- INCLUDE: `server/index.js`에 Grok 영상 생성 처리 로직 추가.
- INCLUDE: `.env`에 Grok 연동을 위한 API KEY 항목 추가.
- EXCLUDE: Grok 외의 다른 유료 영상 엔진 연동 (Luma, Runway 등은 별도 요청 시).
