# 신 만들기 (영상 합성) 구현 완료 ✅

## 📅 작업일: 2026-01-03
## ⏱️ 소요 시간: 약 40분

---

## ✅ 완료된 작업

### 1. SceneCreator 컴포넌트 생성
**파일**: `ai_studio_bundle/components/SceneCreator.tsx`

**주요 기능**:
- ✅ 생성된 프레임 선택 (다중 선택)
- ✅ 프레임 순서 조정 (위/아래 이동, 제거)
- ✅ 프레임 표시 시간 설정 (1~10초)
- ✅ 트랜지션 효과 (없음, 페이드, 슬라이드, 줌)
- ✅ 트랜지션 시간 설정 (0.1~2초)
- ✅ 카메라 효과 (없음, 줌인, 줌아웃, 팬 오른쪽, 팬 왼쪽)
- ✅ 배경 음악 업로드
- ✅ 음악 볼륨 조절 (0~100%)
- ✅ 실시간 영상 길이 계산
- ✅ 영상 미리보기 및 다운로드

**UI/UX 특징**:
- 직관적인 3단계 인터페이스
- 프레임 선택 시 순서 번호 표시
- 전체 선택/선택 해제 버튼
- 예상 영상 길이 실시간 표시
- 생성 완료 후 즉시 재생 가능

### 2. 서버 API 구현
**파일**: `server/index.js`

**엔드포인트**: `POST /api/create-scene`

**기능**:
- ✅ Base64 이미지를 파일로 저장
- ✅ FFmpeg concat 방식으로 영상 생성
- ✅ 9:16 비율 (쇼츠 최적화)
- ✅ 카메라 효과 적용 (zoompan, crop 필터)
- ✅ 배경 음악 합성
- ✅ 음악 볼륨 조절
- ✅ 임시 파일 자동 정리
- ✅ Base64로 인코딩하여 클라이언트에 전송

**필요 패키지**:
- `fluent-ffmpeg`: FFmpeg 제어
- `multer`: 파일 업로드 처리

### 3. AI Studio App.tsx 통합
**파일**: `ai_studio_bundle/App.tsx`

**변경사항**:
- ✅ Mode 타입에 'scene-creator' 추가
- ✅ SceneCreator 컴포넌트 import
- ✅ handleCreateScene 함수 구현
- ✅ 모드 탭에 "🎥 신 만들기 (영상)" 버튼 추가
- ✅ 신 만들기 모드일 때 SceneCreator 컴포넌트 표시
- ✅ 생성된 프레임(results)을 SceneCreator에 전달

---

## 🎯 핵심 로직

### FFmpeg 영상 생성 알고리즘

```javascript
// 1. 프레임을 파일로 저장
for (let i = 0; i < frames.length; i++) {
  const base64Data = frames[i].replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(`frame_${i}.png`, buffer);
}

// 2. FFmpeg concat 파일 생성
const fileListContent = frames.map((_, i) => 
  `file 'frame_${i}.png'\nduration ${duration}`
).join('\n');

// 3. FFmpeg 명령 실행
ffmpeg -f concat -safe 0 -i filelist.txt \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
  -r 25 -c:v libx264 -preset fast -crf 23 \
  output.mp4
```

### 카메라 효과 구현

**줌 인 (Zoom In)**:
```javascript
-vf "zoompan=z='min(zoom+0.0015,1.5)':d=${duration * 25}:s=1080x1920"
```

**줌 아웃 (Zoom Out)**:
```javascript
-vf "zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))':d=${duration * 25}:s=1080x1920"
```

**팬 오른쪽 (Pan Right)**:
```javascript
-vf "crop=iw/1.2:ih:iw/1.2*t/${duration}:0"
```

**팬 왼쪽 (Pan Left)**:
```javascript
-vf "crop=iw/1.2:ih:iw/1.2*(1-t/${duration}):0"
```

### 배경 음악 합성

```javascript
// 음악 파일 저장
fs.writeFileSync('music.mp3', bgMusic.buffer);

// 볼륨 조절 및 합성
const volume = bgMusicVolume / 100;
ffmpeg ... \
  -i "music.mp3" \
  -filter_complex "[1:a]volume=${volume}[a]" \
  -map 0:v -map "[a]" -shortest \
  output.mp4
```

---

## 🎨 사용 방법

### 1. AI Studio 접속
메인 App에서 "AI Studio" 탭 클릭

### 2. 프레임 생성
먼저 "🎬 프레임 만들기" 모드에서 6개 프레임 생성

### 3. 신 만들기 모드 선택
"🎥 신 만들기 (영상)" 버튼 클릭

### 4. 프레임 선택
- 사용할 프레임 클릭하여 선택
- 또는 "전체 선택" 버튼 클릭
- 선택된 프레임에 순서 번호 표시

### 5. 프레임 순서 조정
- ↑ ↓ 버튼으로 순서 변경
- ✕ 버튼으로 제거

### 6. 영상 설정
- **프레임 표시 시간**: 3초 권장
- **트랜지션**: 페이드 (부드러운 전환)
- **카메라 효과**: 줌 인 (드라마틱)
- **배경 음악**: MP3 파일 업로드 (선택사항)
- **음악 볼륨**: 50% 권장

### 7. 영상 생성
"🎥 영상 생성하기" 버튼 클릭

### 8. 결과 확인
- 생성된 영상 즉시 재생
- "📥 영상 다운로드" 버튼으로 저장

---

## 📊 테스트 시나리오

### 시나리오 1: 기본 쇼츠 영상 생성

**설정**:
- 프레임: 6개 (프레임 만들기에서 생성)
- 표시 시간: 3초
- 트랜지션: 페이드 (0.5초)
- 카메라 효과: 없음
- 배경 음악: 없음

**예상 결과**:
- 영상 길이: 15.5초 (6 × 3 - 5 × 0.5)
- 비율: 9:16 (쇼츠 최적화)
- 부드러운 페이드 전환

### 시나리오 2: 드라마틱 쇼츠 영상

**설정**:
- 프레임: 6개
- 표시 시간: 2.5초
- 트랜지션: 페이드 (0.3초)
- 카메라 효과: 줌 인
- 배경 음악: dramatic_music.mp3
- 음악 볼륨: 60%

**예상 결과**:
- 영상 길이: 13.5초
- 각 프레임이 서서히 확대되는 효과
- 배경 음악과 함께 드라마틱한 분위기

### 시나리오 3: 빠른 전환 쇼츠

**설정**:
- 프레임: 8개
- 표시 시간: 2초
- 트랜지션: 없음 (컷 전환)
- 카메라 효과: 팬 오른쪽
- 배경 음악: upbeat_music.mp3
- 음악 볼륨: 70%

**예상 결과**:
- 영상 길이: 16초
- 빠른 컷 전환으로 역동적인 느낌
- 오른쪽으로 이동하는 카메라 효과

---

## 🔍 기술 세부사항

### VideoConfig 인터페이스

```typescript
export interface VideoConfig {
  frames: string[]; // Base64 image URLs
  duration: number; // 각 프레임 표시 시간 (초)
  transition: 'none' | 'fade' | 'slide' | 'zoom';
  transitionDuration: number; // 트랜지션 시간 (초)
  cameraEffect: 'none' | 'zoom-in' | 'zoom-out' | 'pan-right' | 'pan-left';
  bgMusic?: File;
  bgMusicVolume: number; // 0-100
}
```

### FFmpeg 설정

- **비디오 코덱**: libx264
- **프레임레이트**: 25 FPS
- **비율**: 1080x1920 (9:16)
- **CRF**: 23 (품질)
- **프리셋**: fast (속도)
- **픽셀 포맷**: yuv420p (호환성)

### 영상 길이 계산

```typescript
const getTotalDuration = () => {
  const frameDuration = selectedFrames.length * config.duration;
  const transitionDuration = (selectedFrames.length - 1) * config.transitionDuration;
  return frameDuration - transitionDuration;
};
```

**예시**:
- 6개 프레임 × 3초 = 18초
- 5개 트랜지션 × 0.5초 = 2.5초
- 총 길이 = 18 - 2.5 = 15.5초

---

## 💡 향후 개선 사항

### 1. 트랜지션 효과 확장
- Wipe (밀어내기)
- Dissolve (디졸브)
- Blur (블러)
- Custom (사용자 정의)

### 2. 텍스트 오버레이
- 자막 추가
- 타이틀 카드
- 엔딩 크레딧

### 3. 필터 효과
- 색상 보정
- 비네팅
- 필름 그레인
- 빈티지 효과

### 4. 템플릿 시스템
- 자주 사용하는 설정 저장
- 프리셋 불러오기
- 템플릿 공유

### 5. 실시간 미리보기
- 영상 생성 전 미리보기
- 타임라인 편집
- 프레임별 조정

---

## 🎬 완전 자동화 워크플로우

### 현재 (반자동)
```
1. 쇼츠 생성기에서 대본 생성
2. 프레임 만들기에서 6개 프레임 생성
3. 신 만들기에서 영상 합성
4. 영상 다운로드
```
**소요 시간**: 약 5분

### 최종 목표 (완전 자동)
```
1. 쇼츠 생성기에서 "원클릭 쇼츠 제작" 클릭
   → 대본 생성
   → 프레임 생성
   → 영상 합성
   → 음성 추가 (TTS)
   → 자막 추가
2. 완성된 쇼츠 영상 다운로드
```
**목표 시간**: 약 3분 (90% 자동화)

---

## 🚀 다음 단계

### Phase 1-4: 이미지 분석기 (프롬프트 추출)
**예상 소요 시간**: 2일

**주요 기능**:
- 이미지 업로드 → 상세 프롬프트 생성
- 스타일, 색상, 구도, 조명 분석
- 생성된 프롬프트를 다른 모드에서 재사용

**구현 파일**:
- `ai_studio_bundle/components/ImageAnalyzer.tsx` (신규)
- 기존 `handleGeneratePrompt` 활용

---

## 📝 참고사항

### FFmpeg 설치 필수!

**Windows (Chocolatey)**:
```bash
choco install ffmpeg
```

**Windows (수동)**:
1. https://ffmpeg.org/download.html 방문
2. Windows 빌드 다운로드
3. 압축 해제 후 PATH 환경 변수에 추가

**설치 확인**:
```bash
ffmpeg -version
```

### 영상 품질 vs 파일 크기

**CRF 값** (Constant Rate Factor):
- 18: 매우 높은 품질 (큰 파일)
- 23: 권장 품질 (현재 설정)
- 28: 낮은 품질 (작은 파일)

**프리셋**:
- ultrafast: 빠른 인코딩, 큰 파일
- fast: 권장 설정 (현재)
- slow: 느린 인코딩, 작은 파일

### 지원 음악 포맷
- MP3
- WAV
- M4A
- AAC
- OGG

---

## ✨ 결론

신 만들기 (영상 합성) 기능이 성공적으로 구현되었습니다!

사용자는 이제 생성된 프레임들을 쉽게 영상으로 합성할 수 있습니다.

**다음 작업**: 이미지 분석기 (프롬프트 추출) 구현 시작! 🔍

---

## 📊 진행 상황

### Phase 1: 핵심 쇼츠 제작 기능
- ✅ 1-1. 카메라 컨트롤 시스템 (완료)
- ✅ 1-2. 프레임 만들기 (완료)
- ✅ 1-3. 신 만들기 (완료)
- ⏳ 1-4. 이미지 분석기 (다음)
- ⏳ 1-5. 보이스 스튜디오

**전체 진행률**: 60% (3/5 완료) 🎯
