# Body 후처리 기능 추가 및 수정 작업 계획

**작성일**: 2026-02-02
**목표**: 캐릭터 body 정보를 후처리에서 추가 및 수정 가능하도록 구현

---

## 🎯 목표

### 주요 목표
1. **AI가 body를 누락/축약해도 후처리에서 자동으로 추가**
2. **AI가 body를 잘못 생성했으면 후처리에서 정확한 body로 교체**
3. **사용자가 "의상규칙" 탭에서 수정한 body가 실제로 적용되도록**
4. **outfit, hair와 동일한 수준으로 body 관리**

### 기대 효과
- ✅ 캐릭터 외형 일관성 100% 보장
- ✅ 씬마다 body 표현이 동일하게 유지
- ✅ 사용자가 의상규칙에서 body 수정 시 즉시 반영
- ✅ AI의 body 누락/축약 문제 완전 해결

---

## 📊 현재 상태 분석

### ❌ 문제점

1. **AI 생성 대본의 body 문제**
   - AI가 body를 longPrompt에 제대로 반영하지 않음
   - AI가 긴 body 문구를 축약함 (예: "Petite and slim frame with extraordinarily..." → "Petite and slim frame...")
   - 투샷/쓰리샷에서 body 누락이 더 심각함

2. **후처리 기능의 body 누락**
   ```typescript
   // youtube-shorts-script-generator.tsx:440-460
   if (ch.outfit) { updated += `, Outfit: ${ch.outfit}`; }  // ✅ 있음
   if (ch.hair) { updated += `, ${ch.hair}`; }  // ✅ 있음
   // if (ch.body) { ... }  // ❌ 없음!
   ```

3. **사용자 수정 반영 안 됨**
   - 사용자가 "의상규칙" 탭에서 body 수정
   - AI 생성 시 템플릿에만 반영
   - 후처리에서는 강제 적용 안 됨

### ✅ 작동 중인 기능 (참고용)

- **outfit 후처리**: `ch.outfit` → 프롬프트에 추가
- **hair 후처리**: `ch.hair` → 프롬프트에 추가
- **의상 중복 방지**: `hasAddedCharacterOutfit` 플래그로 관리

---

## 📝 상세 체크리스트

### Phase 1: 코드 분석 및 설계 (30분)

- [ ] 1.1 `enhanceScenePrompt` 함수 구조 파악
  - 위치: `youtube-shorts-script-generator.tsx:413-542`
  - 현재 outfit, hair 추가 로직 확인
  - characterMap 구조 확인

- [ ] 1.2 `postProcessScripts` 함수 확인
  - 위치: `youtube-shorts-script-generator.tsx:554-621`
  - characterMap 생성 방식 확인
  - options 파라미터 구조 확인

- [ ] 1.3 characterRules에서 body 가져오는 방식 확인
  - 위치: `services/labPromptBuilder.ts:606-621`
  - `getCharacterRules()` 함수 확인
  - FEMALE_BODY_A, MALE_BODY_A 등 상수 확인

- [ ] 1.4 설계 결정
  - body 추가 위치 결정 (outfit 앞? 뒤?)
  - body 중복 체크 방법 결정
  - AI가 생성한 body 감지 방법 결정

### Phase 2: body 추가 기능 구현 (1시간)

- [ ] 2.1 `enhanceScenePrompt`에 body 추가 로직 삽입
  ```typescript
  // 위치: youtube-shorts-script-generator.tsx:440-460 사이

  // hair 추가 후, outfit 추가 전에 삽입
  if (ch.body && !updated.includes(ch.body)) {
    updated += `, ${ch.body}`;
  }
  ```

- [ ] 2.2 추가 위치 최적화
  - [ ] identity 뒤에 추가
  - [ ] hair 뒤에 추가
  - [ ] outfit 앞에 추가
  - [ ] 순서: identity → hair → body → outfit

- [ ] 2.3 중복 방지 로직 추가
  - [ ] AI가 이미 body를 포함했는지 체크
  - [ ] body 일부만 있어도 감지하도록 개선
  - [ ] 완전 일치가 아닌 부분 일치로 체크

### Phase 3: body 수정 기능 구현 (1시간)

- [ ] 3.1 AI가 생성한 body 감지 로직
  ```typescript
  // AI가 생성한 body 패턴 감지
  const hasAIGeneratedBody = /slim|hourglass|petite|athletic|toned|figure|frame|build|physique/i.test(updated);
  ```

- [ ] 3.2 body 교체 로직 구현
  ```typescript
  if (hasAIGeneratedBody && ch.body) {
    // AI가 생성한 body를 정확한 body로 교체
    updated = replaceAIBodyWithCorrectBody(updated, ch.body);
  }
  ```

- [ ] 3.3 `replaceAIBodyWithCorrectBody` 함수 작성
  - [ ] AI가 생성한 body 패턴 파싱
  - [ ] 정확한 body로 교체
  - [ ] 위치 유지 (identity와 outfit 사이)

### Phase 4: 투샷/쓰리샷 대응 (1시간)

- [ ] 4.1 여러 캐릭터 처리 확인
  - [ ] Person 1, Person 2, Person 3 각각 처리
  - [ ] 각 캐릭터의 body가 개별적으로 추가되는지 확인

- [ ] 4.2 캐릭터별 body 매칭
  ```typescript
  options.characterIds.forEach((id) => {
    const ch = options.characterMap?.[id];
    if (!ch) return;

    // 각 캐릭터의 body 추가
    if (ch.body && !updated.includes(ch.body)) {
      updated += `, ${ch.body}`;
    }
  });
  ```

- [ ] 4.3 Person 블록 내부에 body 삽입
  - [ ] `[Person 1: identity, hair, body, wearing outfit]` 형태로 구조화
  - [ ] Person 블록 파싱 로직 추가 필요 여부 확인

### Phase 5: autoEnhance 플래그 연동 (30분)

- [ ] 5.1 후처리 ON/OFF 설정 반영
  ```typescript
  if (options.autoEnhance && ch.body && !updated.includes(ch.body)) {
    updated += `, ${ch.body}`;
  }
  ```

- [ ] 5.2 후처리 OFF 시 동작 확인
  - [ ] autoEnhance: false → body 추가 안 됨
  - [ ] autoEnhance: true → body 추가됨

### Phase 6: 테스트 (1시간)

- [ ] 6.1 단일 캐릭터 테스트
  - [ ] 원샷 씬에서 body 추가되는지 확인
  - [ ] AI가 body 누락 시 추가되는지 확인
  - [ ] AI가 body 축약 시 전체 body로 교체되는지 확인

- [ ] 6.2 투샷/쓰리샷 테스트
  - [ ] Person 1, 2, 3 모두 body 추가되는지 확인
  - [ ] 각 캐릭터의 body가 혼동되지 않는지 확인

- [ ] 6.3 중복 방지 테스트
  - [ ] AI가 이미 body를 포함한 경우 중복 추가 안 되는지 확인
  - [ ] body 일부만 있어도 감지되는지 확인

- [ ] 6.4 의상규칙 연동 테스트
  - [ ] "의상규칙" 탭에서 Female A body 수정
  - [ ] AI 대본 생성
  - [ ] longPrompt에 수정된 body가 반영되는지 확인

- [ ] 6.5 후처리 ON/OFF 테스트
  - [ ] 후처리 OFF: body 추가 안 됨
  - [ ] 후처리 ON: body 추가됨

- [ ] 6.6 실제 대본 생성 테스트
  - [ ] ai대본생성.txt와 비교
  - [ ] Scene 1~12 모두 body가 일관되게 있는지 확인

### Phase 7: 문서화 및 완료 (30분)

- [ ] 7.1 변경사항 문서화
  - [ ] 수정된 파일 목록
  - [ ] 추가된 함수/로직
  - [ ] 테스트 결과

- [ ] 7.2 완료 보고서 작성
  - [ ] Before/After 비교
  - [ ] 문제점 해결 확인
  - [ ] 추가 개선사항

---

## 🔧 구현 상세

### 1. enhanceScenePrompt 수정 위치

**파일**: `youtube-shorts-script-generator.tsx`
**함수**: `enhanceScenePrompt` (line 413-542)
**삽입 위치**: line 456-460 사이 (hair 추가 후, outfit 추가 전)

```typescript
// 기존 코드 (line 456-459)
if (ch.hair && !updated.includes(ch.hair)) {
  updated += `, ${ch.hair}`;
}

// ===== 여기에 body 추가 로직 삽입 ===== //
if (options.autoEnhance && ch.body) {
  // 1. AI가 이미 정확한 body를 포함했는지 체크
  if (updated.includes(ch.body)) {
    // 이미 정확한 body가 있으면 스킵
    return;
  }

  // 2. AI가 부정확한 body를 생성했는지 감지
  const bodyKeywords = ['slim', 'hourglass', 'petite', 'athletic', 'toned', 'figure', 'frame', 'build', 'physique', 'sophisticated look', 'perky curves'];
  const hasIncorrectBody = bodyKeywords.some(keyword => updated.toLowerCase().includes(keyword.toLowerCase()));

  if (hasIncorrectBody) {
    // 3. AI가 생성한 body를 정확한 body로 교체
    // 간단한 방식: AI body를 제거하고 정확한 body 추가
    bodyKeywords.forEach(keyword => {
      const regex = new RegExp(`,?\\s*${keyword}[^,]*`, 'gi');
      updated = updated.replace(regex, '');
    });
  }

  // 4. 정확한 body 추가
  updated += `, ${ch.body}`;
}

// 기존 코드 계속 (line 460~)
```

### 2. body 교체 로직 (고급)

더 정확한 교체를 위한 함수:

```typescript
const replaceAIBodyWithCorrectBody = (prompt: string, correctBody: string): string => {
  // AI가 생성할 수 있는 body 패턴들
  const bodyPatterns = [
    /,\s*slim hourglass figure[^,]*/gi,
    /,\s*petite and slim frame[^,]*/gi,
    /,\s*gracefully toned athletic body[^,]*/gi,
    /,\s*fit athletic build[^,]*/gi,
    /,\s*well-built physique[^,]*/gi,
    /,\s*sophisticated look[^,]*/gi,
    /,\s*perfectly managed[^,]*/gi
  ];

  let result = prompt;

  // 모든 AI body 패턴 제거
  bodyPatterns.forEach(pattern => {
    result = result.replace(pattern, '');
  });

  // "wearing" 앞에 정확한 body 삽입
  if (result.includes('wearing')) {
    result = result.replace(/,\s*wearing/, `, ${correctBody}, wearing`);
  } else {
    // wearing이 없으면 끝에 추가
    result += `, ${correctBody}`;
  }

  return result;
};
```

### 3. 중복 체크 개선

```typescript
const bodyAlreadyExists = (prompt: string, body: string): boolean => {
  // 1. 완전 일치 체크
  if (prompt.includes(body)) {
    return true;
  }

  // 2. body의 핵심 키워드 체크 (최소 3개 이상 포함되면 이미 있다고 판단)
  const bodyKeywords = body.split(/\s+/).filter(word => word.length > 3);
  const matchCount = bodyKeywords.filter(keyword =>
    prompt.toLowerCase().includes(keyword.toLowerCase())
  ).length;

  return matchCount >= 3;
};
```

---

## 🧪 테스트 시나리오

### 시나리오 1: AI가 body 누락

**입력 (AI 생성)**:
```
A stunning Korean woman in her 40s, long soft-wave hairstyle, wearing Navy dress
```

**출력 (후처리 후)**:
```
A stunning Korean woman in her 40s, long soft-wave hairstyle, perfectly managed sophisticated look, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves, wearing Navy dress
```

### 시나리오 2: AI가 body 축약

**입력 (AI 생성)**:
```
A stunning Korean woman in her 40s, Petite and slim frame, wearing Mint bra
```

**출력 (후처리 후)**:
```
A stunning Korean woman in her 40s, Petite and slim frame with an extraordinarily voluminous high-projection bust, surprising perky curves, high-seated chest line, wearing Mint bra
```

### 시나리오 3: AI가 정확한 body 생성 (이미 있음)

**입력 (AI 생성)**:
```
A stunning Korean woman in her 40s, perfectly managed sophisticated look, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves, wearing Navy dress
```

**출력 (후처리 후)**:
```
(변경 없음 - 중복 방지)
```

### 시나리오 4: 투샷에서 각 캐릭터 body 추가

**입력 (AI 생성)**:
```
[Person 1: A stunning Korean woman, short bob cut, wearing Mint bra]
[Person 2: A handsome Korean man, wearing Navy polo]
```

**출력 (후처리 후)**:
```
[Person 1: A stunning Korean woman, short bob cut, Petite and slim frame with extraordinarily voluminous high-projection bust, wearing Mint bra]
[Person 2: A handsome Korean man, fit athletic build with broad shoulders, wearing Navy polo]
```

---

## 📂 수정 파일 목록

1. **youtube-shorts-script-generator.tsx**
   - `enhanceScenePrompt` 함수 (line 413~)
   - body 추가 로직 삽입
   - body 교체 로직 추가

2. **(선택) 헬퍼 함수 추가**
   - `replaceAIBodyWithCorrectBody`
   - `bodyAlreadyExists`

---

## ⚠️ 주의사항

1. **순서 중요**
   - identity → hair → **body** → outfit 순서 유지
   - outfit 앞에 body가 와야 자연스러움

2. **중복 방지**
   - body가 이미 있으면 추가 안 함
   - 일부만 있어도 감지해야 함

3. **후처리 플래그 확인**
   - `options.autoEnhance`가 false면 추가 안 함
   - 사용자가 후처리 OFF했으면 존중

4. **투샷/쓰리샷 처리**
   - 각 Person 블록마다 개별적으로 처리
   - characterIds 배열 순회 필요

5. **성능 고려**
   - 정규식 사용 시 성능 체크
   - 긴 문자열 반복 교체 주의

---

## 📊 예상 작업 시간

| Phase | 내용 | 예상 시간 |
|-------|------|----------|
| Phase 1 | 코드 분석 및 설계 | 30분 |
| Phase 2 | body 추가 기능 | 1시간 |
| Phase 3 | body 수정 기능 | 1시간 |
| Phase 4 | 투샷/쓰리샷 대응 | 1시간 |
| Phase 5 | autoEnhance 연동 | 30분 |
| Phase 6 | 테스트 | 1시간 |
| Phase 7 | 문서화 | 30분 |
| **합계** | | **5.5시간** |

---

## ✅ 완료 기준

- [ ] 원샷 씬에서 body가 정확하게 추가됨
- [ ] 투샷/쓰리샷에서 각 캐릭터의 body가 개별적으로 추가됨
- [ ] AI가 body 누락 시 자동으로 추가됨
- [ ] AI가 body 축약 시 전체 body로 교체됨
- [ ] 중복 추가 방지됨
- [ ] 후처리 ON/OFF 설정이 정상 작동
- [ ] 의상규칙 탭에서 수정한 body가 실제로 반영됨
- [ ] ai대본생성.txt 문제 해결 확인

---

**작업 시작 전 확인사항**:
1. 현재 코드 백업
2. git commit 상태 확인
3. 테스트 대본 준비

**작업 완료 후 확인사항**:
1. 모든 체크리스트 완료
2. 테스트 시나리오 통과
3. Before/After 비교 문서 작성
