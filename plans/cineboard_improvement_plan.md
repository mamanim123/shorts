# Cineboard 전체 개선 구현 계획

## 목표

김씨네프롬프트.txt에 명시된 모든 기능을 `CineboardPanel.tsx`에 구현하여 완전한 AI 시네보드 시스템을 완성합니다.

## 제안된 변경사항

### 1단계: 타입 정의 및 상태 추가

#### [MODIFY] [CineboardPanel.tsx](file:///f:/test/쇼츠대본생성기-v3.1.0/components/CineboardPanel.tsx)

**타입 확장**
- `CineboardScene` 타입에 다음 필드 추가:
  - `scriptRef?: string` - 원본 대본 텍스트 (스크립트 앵커링)
  - `dialogueRefined?: string` - 정제된 대사 (감정지문 제거)
  - `screenText?: string` - 화면 표시 텍스트 (쇼츠용)
  - `shotType?: string` - 샷 타입 (FULL SHOT, MEDIUM CLOSE-UP 등)
  - `isSelected?: boolean` - 쇼츠 변환용 선택 상태

**새로운 상태 추가**
- `generationProgress` - 생성 진행 상황 (단계별 상태)
- `selectedScenes` - 쇼츠 변환용 선택된 씬들
- `progressStage` - 현재 진행 단계 ('analyzing' | 'generating' | 'prompting' | 'complete')

---

### 2단계: 진행 상황 표시 시스템

#### [MODIFY] [CineboardPanel.tsx](file:///f:/test/쇼츠대본생성기-v3.1.0/components/CineboardPanel.tsx)

**진행 상황 컴포넌트 추가**
- 생성 단계별 상태 표시 UI
- 진행률 바 (Progress Bar)
- 현재 작업 중인 단계 하이라이트

**handleGenerateCineboard 함수 수정**
- 각 단계마다 `setProgressStage` 호출
- 단계: 인물 분석 → 씬 생성 → 프롬프트 작성 → 완료

---

### 3단계: 스크립트 앵커링 구현

#### [MODIFY] [CineboardPanel.tsx](file:///f:/test/쇼츠대본생성기-v3.1.0/components/CineboardPanel.tsx)

**대본 분할 로직**
- `buildCineboardUserPrompt` 함수에서 대본을 씬 개수만큼 분할
- 각 씬에 해당하는 원본 텍스트를 `scriptRef`에 저장

**UI 표시**
- 각 씬 카드 하단에 "원본 대본" 섹션 추가
- 접기/펼치기 기능으로 공간 절약

---

### 4단계: 카드 형식 UI 개선

#### [MODIFY] [CineboardPanel.tsx](file:///f:/test/쇼츠대본생성기-v3.1.0/components/CineboardPanel.tsx)

**씬 카드 레이아웃 변경**
- 이미지 미리보기를 상단에 크게 배치
- 샷 번호 (S01, S02...) 오버레이로 표시
- 샷 타입 (FULL SHOT 등) 배지로 표시
- 카드 그리드 레이아웃 (2-3열)

**카메라 정보 파싱**
- `camera` 필드에서 샷 타입 추출
- 예: "Medium Two-shot, Eye level" → "MEDIUM CLOSE-UP"

---

### 5단계: 일괄 다운로드 기능

#### [MODIFY] [CineboardPanel.tsx](file:///f:/test/쇼츠대본생성기-v3.1.0/components/CineboardPanel.tsx)

**새로운 함수 추가**
- `handleBatchDownloadImages()` - 모든 씬 이미지 ZIP 다운로드
- JSZip 라이브러리 사용하여 이미지 압축
- 개별 씬 이미지 다운로드 버튼 추가

**UI 버튼**
- "전체 이미지 다운로드" 버튼 추가
- 각 씬에 "이미지 저장" 버튼 추가

---

### 6단계: 프로덕션 리포트 생성

#### [MODIFY] [CineboardPanel.tsx](file:///f:/test/쇼츠대본생성기-v3.1.0/components/CineboardPanel.tsx)

**새로운 함수 추가**
- `generateProductionReport()` - 완전한 작업 지침서 생성
- 포함 내용:
  - 프로젝트 정보 (제목, 날짜, 스타일)
  - 등장 인물 목록 및 특징
  - 배경음악 정보
  - 씬별 상세 정보 (번호, 요약, 카메라, 프롬프트, 원본 대본)

**다운로드 형식**
- TXT 형식으로 다운로드
- 마크다운 형식 지원

---

### 7단계: 쇼츠 재편성 기능

#### [MODIFY] [CineboardPanel.tsx](file:///f:/test/쇼츠대본생성기-v3.1.0/components/CineboardPanel.tsx)

**씬 선택 시스템**
- 각 씬 카드에 체크박스 추가
- `selectedScenes` 상태로 선택 관리

**쇼츠 변환 함수**
- `handleConvertToShorts()` - 선택한 씬을 9:16으로 재생성
- 비율 자동 변경 및 프롬프트 조정

**UI 버튼**
- "선택한 씬을 쇼츠로 변환" 버튼 추가

---

### 8단계: 대사 정제 기능

#### [MODIFY] [CineboardPanel.tsx](file:///f:/test/쇼츠대본생성기-v3.1.0/components/CineboardPanel.tsx)

**정제 로직**
- `refineDialogue(text: string)` 함수 추가
- 정규식으로 감정지문 제거: `(괴로워하며)`, `(분노하며)` 등
- 순수 대사만 추출

**UI 표시**
- "정제된 대사" 탭 추가
- 원본 vs 정제본 비교 표시

---

### 9단계: 화면 텍스트/대사 자동 생성

#### [MODIFY] [CineboardPanel.tsx](file:///f:/test/쇼츠대본생성기-v3.1.0/components/CineboardPanel.tsx)

**AI 생성 함수**
- `generateScreenText(scene)` - 쇼츠용 화면 텍스트 생성
- 각 씬의 핵심 메시지를 짧은 텍스트로 변환

**UI 표시**
- "화면 텍스트" 필드 추가
- 복사 버튼으로 쉽게 활용

---

## 검증 계획

### 자동 테스트
현재 프로젝트에 테스트 파일이 없으므로 자동 테스트는 생략합니다.

### 수동 테스트

#### 테스트 1: 진행 상황 표시
1. 애플리케이션 실행: `npm run dev`
2. 씨네보드 탭으로 이동
3. 대본 입력 후 "씨네보드 생성" 클릭
4. **확인 사항**: 
   - "인물 분석 중..." → "씬 생성 중..." → "프롬프트 작성 중..." 순서로 표시
   - 진행률 바가 증가하는지 확인

#### 테스트 2: 스크립트 앵커링
1. 씨네보드 생성 완료 후 "생성 결과" 탭으로 이동
2. 각 씬 카드 확인
3. **확인 사항**:
   - 각 씬 하단에 "원본 대본" 섹션이 있는지
   - 해당 씬에 맞는 대본 텍스트가 표시되는지

#### 테스트 3: 카드 형식 UI
1. "생성 결과" 탭에서 씬 목록 확인
2. **확인 사항**:
   - 이미지가 카드 상단에 크게 표시되는지
   - 샷 번호 (S01, S02...) 오버레이가 보이는지
   - 샷 타입 배지 (FULL SHOT 등)가 표시되는지

#### 테스트 4: 일괄 다운로드
1. "전체 이미지 다운로드" 버튼 클릭
2. **확인 사항**:
   - ZIP 파일이 다운로드되는지
   - ZIP 파일 안에 모든 씬 이미지가 포함되어 있는지

#### 테스트 5: 프로덕션 리포트
1. "프로덕션 리포트 다운로드" 버튼 클릭
2. **확인 사항**:
   - TXT 파일이 다운로드되는지
   - 파일에 등장 인물, 배경음악, 씬별 정보가 모두 포함되어 있는지

#### 테스트 6: 쇼츠 재편성
1. 원하는 씬들을 체크박스로 선택
2. "선택한 씬을 쇼츠로 변환" 버튼 클릭
3. **확인 사항**:
   - 비율이 9:16으로 변경되는지
   - 선택한 씬들만 재생성되는지

#### 테스트 7: 대사 정제
1. 감정지문이 포함된 대본으로 테스트 (예: "안녕하세요(미소지으며)")
2. 씬 카드에서 "정제된 대사" 탭 확인
3. **확인 사항**:
   - 감정지문이 제거되고 순수 대사만 표시되는지

#### 테스트 8: 화면 텍스트 생성
1. 쇼츠 모드에서 씬 생성
2. 각 씬의 "화면 텍스트" 필드 확인
3. **확인 사항**:
   - 짧고 임팩트 있는 텍스트가 생성되는지
   - 복사 버튼이 작동하는지

---

> [!IMPORTANT]
> 이 구현은 대규모 변경사항을 포함합니다. 단계별로 진행하며, 각 단계마다 테스트를 거쳐 안정성을 확보합니다.

> [!WARNING]
> JSZip 라이브러리가 필요합니다. `package.json`에 추가해야 합니다.
