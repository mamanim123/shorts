# 작업명: 쇼츠 생성기 이미지 모델 드롭다운에 fast 계열 고정 노출

## 목표
- API 응답에 fast 계열이 없어도 드롭다운에서 선택 가능하게 수동 기본 리스트를 병합한다.

## 작업 단계
1. `components/master-studio/services/geminiService.ts`의 `fetchAvailableModels`에 수동 기본 모델 배열(예: imagen-2.5-fast, imagen-3.0-fast, imagen-4.0-generate-001 등)을 추가해 응답 리스트와 병합하도록 수정한다.
2. `youtube-shorts-script-generator.tsx`에서 `availableModels` 설정/새로고침 로직이 병합된 리스트를 사용하도록 확인하고, 중복 제거·정렬 후 현재 선택 모델이 없을 때 우선순위대로 기본값을 설정하도록 조정한다.
3. 드롭다운 UI는 동일하게 유지하되, 수동 모델이 노출되는지 확인하고 필요 시 주석/툴팁으로 fast vs 4.0 차이를 명시한다.

