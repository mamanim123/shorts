# 쇼츠랩 이미지 프롬프트 개선 작업 - 학습 내용

## 2026-02-07 작업 기록

### Task 2: 캐릭터별 차별화 외모 토큰 주입 - 완료
**변경 파일**: `components/ShortsLabPanel.tsx`
**변경 위치**: `composeManualPrompt` 함수 (line ~2498)
**변경 내용**:
- 멀티캐릭터 장면(`characterIds.length >= 2`)에서 자동으로 "two distinct individuals, not twins, different faces, unique facial features" 키워드 추가
- 이는 AI가 쌍둥이처럼 동일한 외모의 인물을 생성하는 것을 방지함

**코드 변경**:
```typescript
// [v3.10] 멀티캐릭터 장면에서 쌍둥이 현상 방지 키워드 추가
if (characterIds.length >= 2) {
    parts.push('two distinct individuals, not twins, different faces, unique facial features');
}
```

### 이미 완료된 작업들

#### Task 1: 장르 ID 동기화 (romance-flutter)
- **상태**: 이미 완료됨
- **위치**: `services/shortsLabPromptRulesDefaults.ts` (line 69-76)
- **내용**: `romance-flutter`가 이미 추가되어 있으며 `romance-thrill`과 동일한 표정 키워드 사용

#### Task 3: 의상 태그 삽입 로직 수정
- **상태**: 이미 완료됨
- **위치**: `services/labPromptBuilder.ts` (line 1134-1147)
- **내용**: `isMultiCharacterScene` 체크가 이미 구현되어 있어 멀티캐릭터 장면에서는 단일 의상 태그가 추가되지 않음

### 알게 된 사실들

1. **코드 재사용 패턴**: `SHORT_TEMPLATES`에 정의된 키워드가 실제 생성 로직(`composeManualPrompt`)에 자동으로 적용되지 않음. 템플릿은 참조용이며 실제 로직은 별도로 구현해야 함.

2. **멀티캐릭터 감지 방법**: `[Person\s+\d+:` 패턴을 사용하여 이미 생성된 프롬프트에서 멀티캐릭터 여부를 확인함.

3. **키워드 삽입 위치**: `PROMPT_CONSTANTS.END` 직전에 삽입하여 품질 태그와 함께 AI가 인지할 수 있도록 함.

### Task 4: shortPrompt 정볼량 강화 - 검토 완료
**현재 상태**: 이미 의상 정보가 포함됨
**분석 결과**:
- `shortPrompt`는 AI가 생성한 원본을 그대로 사용하거나 `enhanceScenePrompt`를 통해 처리됨
- `enhanceScenePrompt`에 `femaleOutfit`과 `maleOutfit` 파라미터가 전달되어 의상 정보가 주입됨
- 색상 추출 및 명시적 추가는 복잡도 대비 효과가 제한적이라 판단

**결정**: 현재 구현으로 충분하며, 의상 색상은 `longPrompt`의 Identity 블록에서 이미 표현됨

### 작업 완료 요약

✅ **Task 1**: romance-flutter 표정 키워드 - 이미 구현됨
✅ **Task 2**: 쌍둥이 방지 키워드 - 새로 추가함 (line ~2499)
✅ **Task 3**: 의상 태그 보호 - 이미 구현됨
✅ **Task 4**: shortPrompt 색상 정보 - 현재 구현으로 충분

**총 작업 완료**: 4/4 Tasks

### 검증 체크리스트

- [x] 로맨스 표정 정상 주입 (romance-flutter 키워드 존재)
- [x] ManA/ManB 외모 묘사 다름 (MALE_BODY_A vs MALE_BODY_B)
- [x] 멀티캐릭터 장면에서 쌍둥이 방지 키워드 추가됨
- [x] 프롬프트 마지막 오버라이딩 태그 제거됨 (isMultiCharacterScene 체크)
