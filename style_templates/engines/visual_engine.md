# [Visual Engine] 프리미엄 이미지 생성 지침 (Premium Consistency)

## 1. 품질 및 스타일 정의
모든 이미지 프롬프트는 다음의 하이엔드 품질 기준을 포함해야 합니다.

- **핵심 태그**: `8k ultra photorealism`, `ultra detailed skin texture`, `professional cinematic lighting`, `RAW photo`, `high-fashion editorial refined`, `depth of field`.
- **한국인 정체성**: 반드시 `Korean identity`를 명시하여 이질적인 외형 방지.
- **분위기**: 일관된 조명(HDR, Soft Daylight, Warm Golden Hour 등)을 씬 전체에 적용.

## 2. 인물 및 의상 일관성 (Consistency)
- **Slot System**: 등장인물별로 `Woman A`, `Woman B` 등 슬롯을 지정하고 의상/헤어를 고정.
- **의상 묘사**: 구체적인 텍스트(예: `White Silk Deep V-neck Blouse`)를 모든 관련 씬 프롬프트의 동일한 위치에 삽입.
- **표정 및 액션**: 동일한 인물이라도 씬마다 시선, 손동작, 표정은 대본의 상황에 맞게 동적으로 변화.

## 3. 카메라 및 구도
- **다양한 앵글**: 중복되는 구도를 피하고 스토리의 긴장감에 따라 앵글 교체.
  - `Close-up`: 감정 강조
  - `Medium Shot`: 인물 간의 거리감 및 의상 강조
  - `Low/High Angle`: 상황의 압박감 또는 여유 강조

## 4. 제약 사항
- **No Text**: 이미지 내에 글자, 로고, 워터마크가 나타나지 않도록 `no text, no captions, no typography` 지수 절대 포함.
- **만화적 요소 배제**: 인공적인 블러 처리가 아닌 실제 렌즈의 심도(Bokeh) 표현 지향.
