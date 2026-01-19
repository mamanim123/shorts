# Phase 3 — 원클릭 & 배치 파이프라인 설계

## 🎯 목표
- **원클릭 쇼츠 제작**: 대본 → 프레임 → 영상 → 음성 → 후처리까지를 한 번의 액션으로 자동 실행.
- **배치 생성**: 여러 개의 대본/스토리를 큐에 넣어 순차 실행하고, 완료물(`generated_scripts/`, `longform_sessions/`, `server/user_data_*`)에 모아 저장.
- 실행 중 중단/재시작, 실패 항목 재시도, 진행 상황 표시 등 오퍼레이션 편의 기능 포함.

---

## 🧱 아키텍처 개요

### 파이프라인 단계 (공통)
1. **대본 확보**: 쇼츠 생성기에서 현재 스토리 or 배치 입력 CSV/JSON.
2. **프레임 생성**: `FrameGenerator` → `generateImageFromImagesAndText` 호출.
3. **편의 보정(선택)**: 스타일/색/포즈/편의 기능 옵션을 적용할지 여부.
4. **신(영상) 생성**: `SceneCreator` → `/api/create-scene`.
5. **음성생성**: `VoiceStudio` → `/api/text-to-speech`(향후 GCP TTS).
6. **합성 및 결과 저장**: 영상/음성을 결합하거나 별도 전달, 히스토리 및 파일 저장소 기록.

### 실행 컨트롤
- 파이프라인 상태 머신: `idle` → `running(stage=N)` → `completed`/`failed`.
- 이벤트 버스/Hook(`usePipelineRunner`)로 각 단계별 로깅, UI 알림, 중단 요청 처리.
- 실패 시 정책:
  - 치명적 단계(대본/프레임)에러: 파이프라인 중단 + 사용자에게 오류/재시도 버튼 제공.
  - 후처리 실패: 해당 단계만 스킵하고 다음으로 진행 옵션.

---

## 🧩 구현 계획

### 1. 프런트 (쇼츠 생성기 화면)
| 기능 | 설명 | 구현 포인트 |
| --- | --- | --- |
| `usePipelineRunner` 훅 | 파이프라인 상태, 진행 로그, 취소 핸들링을 캡슐화 | 기존 `handleGenerateImage`, `handleCreateScene`, `handleGenerateVoice` 등을 래핑 |
| One-Click UI | 스토리 상세 패널 상단에 `⚡ 원클릭 쇼츠 제작` 버튼 + 상태 패널 | 실행 중 progress bar, 현재 단계 텍스트 및 취소 버튼 |
| 배치 실행 UI | 좌측 툴바 혹은 상단 탭에 `Batch` 모달 | CSV/JSON 업로드 → 각 항목마다 파이프라인 컨피그 설정 |
| 히스토리 연동 | 파이프라인 완료 시 `generated_scripts/` + `history.json` 업데이트 | 기존 `onAddHistory` 콜백 재사용 |

#### 파이프라인 옵션 구조
```ts
interface PipelineOptions {
  storyId: string;
  applyStyle?: { tonePreset: string };
  applyConvenience?: {
    objectRemove?: { description: string };
    aspect?: '9:16' | '1:1' | '16:9';
    cleanLevel?: number;
  };
  video: { duration: number; transition: 'fade' | 'slide'; cameraEffect: string };
  voice: { voiceType: string; emotion: string };
  savePaths: { framesDir: string; videoDir: string };
}
```

### 1-a. 프레임 → 영상 → 음성 → 최종 합성 플로우
| Stage key | 필요 데이터 | 로직/호출 | 산출물 |
| --- | --- | --- | --- |
| `frames` | scenes[].longPrompt / shortPrompt | 기존 이미지 생성 (롱 실패 시 숏 fallback), 히스토리 저장 | `generated_scripts/{storyId}/frames/frame_{n}.png` |
| `video` | 프레임 파일, 카메라/트랜지션 옵션 | `/api/create-scene` FormData 호출 → ffmpeg 합성 | `generated_scripts/{storyId}/scene.mp4` |
| `voice` | script 전체 혹은 씬 단위 텍스트 | Web Speech 대체 or `VoiceStudio` API, 향후 GCP TTS Key 사용 | `generated_scripts/{storyId}/voice.mp3` |
| `merge` | video + voice | `/api/merge-video-audio` (신규) 혹은 프런트 ffmpeg-worker | `generated_scripts/{storyId}/final_{storyId}.mp4` |
| `extras` (선택) | 편의 기능 옵션 | Phase2/3 컴포넌트 API 호출 (예: 객체 제거) | 후처리된 이미지/썸네일 |

각 단계 완료 시 파이프라인 패널에 체크/로그 기록, 단계별 재시도 버튼 추가.

### 2. 배치 큐
- `useBatchQueue` 훅: `items: PipelineOptions[]`, `currentIndex`, `results`.
- 실행 로직:
  1. 큐 생성 → 각 항목에 고유 ID/스토리명 부여.
  2. `runNext()` 호출 시 `usePipelineRunner` 를 재활용.
  3. 실패 항목은 `failedItems` 리스트에 모아 재시도 버튼 제공.
  4. 진행률/ETA 표시 (생성 시간 평균값 기반).

### 3. 서버/파일 입출력
- 현재 영상 생성 `/api/create-scene`와 `VoiceStudio`는 준비됨.
- 필요 시 배치 결과 기록용 API 추가:
  - `POST /api/pipeline-log` (선택): 단계별 로그 저장 → 추후 모니터링/리포팅.
  - `POST /api/pipeline-artifacts`: 최종 영상/오디오를 지정 폴더로 이동/압축.
- 파일 저장 경로 (골든 룰 준수):
  - `generated_scripts/{storyId}/frames/*.png`
  - `generated_scripts/{storyId}/scene.mp4`
  - `generated_scripts/{storyId}/voice.mp3`
  - `generated_scripts/{storyId}/log.json`

### 4. 예외 처리 & 복구
- **중단/취소**: 사용자가 취소하면 현재 단계 중단 신호 → 네트워크 작업 abort → 상태 `cancelled`.
- **전원/브라우저 종료 대비**: 로컬스토리지에 `pipelineState` 스냅샷 저장 → 재입장 시 복구 안내.
- **배치 실패 관리**: `failedItems` 탭에서 개별 재시도/전체 재시도 버튼 제공.
- **단계별 재시도**: 이미지 성공/영상 실패 등 케이스를 구분해 해당 Stage만 재실행할 수 있는 `failedStages` 큐 운영.

---

## 📋 단계별 TODO
1. `usePipelineRunner` 훅 + 타입 정의 (`types.ts`).
2. 쇼츠 생성기 UI에 단일 실행 버튼 + 상태 패널 추가.
3. 배치 실행 모달, 큐 로직, 진행 상태 표시.
4. 생성 결과 저장/히스토리 업데이트 자동화.
5. 영상/음성/합성 Stage를 `usePipelineRunner`에 편입 후 단계별 재시도 UI 제공.
6. (선택) 서버 로그 API/결과 압축 API 추가.
7. 문서화 (`plans` / README) 및 QA (여러 스토리 케이스, 실패 시나리오).

---

## ✅ 완료 기준
- 버튼 한 번으로 전체 쇼츠 제작 파이프라인이 자동 실행되고, 각 단계 진행 상황이 시각적으로 표시된다.
- 배치 실행으로 여러 스토리를 연속 처리할 수 있으며, 실패 항목 재시도가 가능하다.
- 결과물은 지정 폴더(`generated_scripts/…`)에 저장되고 히스토리에 기록된다.
- 중단/복구 및 에러 토스트 동작이 안정적으로 구현된다.

마마님, 이 설계안 검토 후 승인 주시면 실제 구현에 착수하겠습니다!

---

## 📘 Phase 3 사용법 (원클릭/배치 파이프라인)

### 1. 실행 대기열 & 수동 단계 선택
1) 쇼츠 생성기 상단 파이프라인 패널의 “시작 단계 선택” 버튼으로 `자동 / 이미지 / 영상 / 음성 / 합성` 중 하나를 지정합니다.  
2) `원클릭` 버튼(저장본 카드, 생성된 대본 카드 등)을 누르면 방금 지정한 단계부터 실행됩니다.  
3) `배치` 버튼을 누르면 동일한 설정으로 큐에 적재되며, Queue 칩 옆에 “(영상부터)”처럼 표시됩니다.  
4) 실행 중에는 “실행 중단” 버튼으로 현재 씬을 완료한 후 정지할 수 있고, 실패한 씬은 Failures 영역에서 다시 원클릭/배치로 넣어 복구합니다.  

### 2. 이미지 생성(Stage `frames`)
- 스토리의 각 씬 프롬프트를 순차 호출하며, 롱 프롬프트 차단 시 Short Prompt로 한 번 자동 재시도합니다.  
- 저장 경로: `generated_scripts/<story>/images/scene_*.png`  
- 실패 로그는 Failures 패널에 기록되며, 지정하면 개별 씬만 재생성 가능합니다.  

### 3. 영상 생성(Stage `video`)
- 이미지가 준비되면 `/api/create-scene` + FFmpeg를 통해 `<story>/video/*.mp4`로 저장합니다.  
- 파이프라인 패널에는 프레임 수집 여부/저장파일이 표기되며, 로그에서 FFmpeg 실행 결과를 확인할 수 있습니다.  

### 4. 음성 생성(Stage `voice`)
- 대본 전체(또는 씬 narration)를 합쳐 `/api/text-to-speech`에 전달합니다.  
- 로컬 파형 합성으로 `.wav` 파일을 `<story>/audio/`에 저장하고, 로그·패널에 파일명/음성 옵션이 기록됩니다.  

### 5. 합성(Stage `merge`)
- `/api/merge-video-audio`를 호출해 영상·음성을 자동 결합합니다.  
- 최종 결과는 `<story>/video/final_*.mp4`에 저장되며, 패널에 파일명과 메모가 표시됩니다.  
- 합성을 건너뛰고 싶으면 시작 단계에서 “합성”을 제외하고 영상·음성만 수동으로 생성하면 됩니다.  

### 6. 기타 Tips
- **단계 초기화**: 스토리 카드 또는 파이프라인 패널에서 “단계 초기화” 버튼으로 해당 스토리의 진행 기록을 리셋할 수 있습니다.  
- **로그 확인**: 파이프라인 패널 하단 로그 영역에서 최대 최근 40건의 기록을 확인합니다.  
- **API 요약**  
  - `POST /api/create-scene` — 프레임 → 영상  
  - `POST /api/save-video` — 영상 저장  
  - `POST /api/text-to-speech` — 음성 파일 생성  
  - `POST /api/merge-video-audio` — 영상·음성 합성  
- **폴더 구조**  
  - 이미지: `generated_scripts/<story>/images/`  
  - 영상: `generated_scripts/<story>/video/`  
  - 음성: `generated_scripts/<story>/audio/`  
  - 합성 결과: `generated_scripts/<story>/video/final_*.mp4`
