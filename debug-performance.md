# 성능 디버깅 리포트 (2025-12-23)

## 1. 발견된 주요 문제

### ❌ **서버 시작 실패 - Puppeteer 초기화 오류**
- **위치**: `server/index.js:79` - `launchBrowser()`  
- **원인**: Puppeteer가 서버 시작 시 자동으로 브라우저를 실행하려다 실패
- **영향**: 전체 애플리케이션이 시작되지 않음

## 2. 성능 버벅거림의 잠재적 원인 분석

### 📊 **대용량 데이터 처리**
- **history.json 파일**: 3MB (3,056,073 bytes)
  - 매번 페이지 이동 시 전체 히스토리를 로드/저장
  - localStorage 동기화로 인한 병목

- **generated_scripts 디렉토리**: 158개 파일
  - 많은 수의 생성된 대본 파일

### 🔍 **코드 레벨 문제점**

#### **1. App.tsx - 불필요한 서버 동기화**
```typescript
// Line 230-242: 컴포넌트 마운트 시마다 서버에서 전체 히스토리 로드
useEffect(() => {
  const fetchServerHistory = async () => {
    const res = await fetch('http://localhost:3002/api/history');
    const serverHistory: StoryResponse[] = await res.json();
    setStories(serverHistory); // 전체 히스토리 교체
  };
  fetchServerHistory();
}, []); // 빈 의존성 배열이지만 stories.length로 인한 재렌더링
```

#### **2. localStorage 중복 저장**
```typescript
// Line 202-211: stories 변경 시마다 localStorage 저장
useEffect(() => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stories));
}, [stories]); // stories가 변경될 때마다 실행 (3MB 저장)

// Line 213-225: 동시에 서버에도 저장
const saveHistory = async (newStories: StoryResponse[]) => {
  await fetch('http://localhost:3002/api/history', {
    method: 'POST',
    body: JSON.stringify(newStories), // 3MB 전송
  });
};
```

#### **3. 이미지 히스토리 중복 키 문제**
- `plans/20251223_이미지히스토리_중복키_수정.md` 참조
- 중complexKey 관련 수정이 진행 중인 것으로 보임

## 3. **즉각적인 해결 방안**

### 🔧 **Puppeteer 자동 시작 비활성화**
```javascript
// server/index.js:78-79
// Initialize Browser on start
// launchBrowser(); // [DISABLED] 온디멘드로 실행
```

### ⚡ **히스토리 로딩 최적화**
1. **페이지네이션 도입**: 한 번에 50개씩만 로드
2. **인덱싱**: 최근 항목만 메모리에 유지
3. **가상화**: react-window 사용

### 💾 **저장 로직 개선**
1. **디바운싱**: 500ms 후 저장
2. **변경 감지**: 실제 변경된 항목만 저장
3. **압축**: LZ-String 사용

## 4. **대기 중 - 다음 단계**

사용자 확인 대기 중입니다. 다름 작업을 지시해주세요:

- ✅ Puppeteer 문제 해결 후 서버 실행
- ✅ 브라우저에서 실제 성능 측정 (React DevTools Profiler)
- ✅ 히스토리 최적화 구현
- ✅ 이미지 중복 키 문제 확인

---
**작성**: Antigravity AI  
**날짜**: 2025-12-23 13:06 KST
