/**
 * exportService.ts
 * 캡컷(CapCut) 및 SRT 자막 내보내기 기능을 담당하는 서비스
 */

export interface ExportData {
  title: string;
  scenes: Array<{
    number: number;
    text: string;
    imageUrl?: string;
    audioUrl?: string;
    duration?: number; // 초 단위
  }>;
}

/**
 * 간단한 SRT 자막 파일을 생성합니다.
 */
export const generateSRT = (data: ExportData): string => {
  let srt = '';
  let currentTime = 0;

  data.scenes.forEach((scene, index) => {
    const duration = scene.duration || 5; // 기본 5초
    const startTime = formatSRTTime(currentTime);
    const endTime = formatSRTTime(currentTime + duration);

    srt += `${index + 1}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${scene.text}\n\n`;

    currentTime += duration;
  });

  return srt;
};

const formatSRTTime = (seconds: number): string => {
  const date = new Date(0);
  date.setSeconds(seconds);
  const ms = Math.floor((seconds % 1) * 1000);
  return date.toISOString().substr(11, 8) + ',' + ms.toString().padStart(3, '0');
};

/**
 * 캡컷(CapCut)과 호환되는 FCPXML 구조를 생성합니다. (기본형)
 */
export const generateCapCutXML = (data: ExportData): string => {
  const title = data.title || 'Shorts Project';
  let clipsXml = '';
  let currentTime = 0;

  data.scenes.forEach((scene, idx) => {
    const duration = (scene.duration || 5) * 3600; // 30fps 기준 프레임 계산 (예시)
    clipsXml += `
      <asset-clip id="scene_${idx}" name="Scene ${idx+1}" start="0s" duration="${scene.duration || 5}s">
        <!-- 이미지 및 오디오 정보가 여기에 매핑됩니다 -->
      </asset-clip>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.8">
  <library>
    <event name="${title}">
      <project name="${title}">
        <sequence duration="${data.scenes.length * 5}s" format="r0">
          <spine>
            ${clipsXml}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;
};

/**
 * 파일 다운로드를 실행합니다.
 */
export const downloadFile = (content: string, fileName: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};
