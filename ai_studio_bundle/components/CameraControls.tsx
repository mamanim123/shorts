import React, { useState } from 'react';

export interface CameraSettings {
  shotSize: string;
  angle: string;
  movement: string;
  lighting: string;
}

const CAMERA_PRESETS = {
  shotSize: [
    'Extreme Close-up (ECU)',
    'Close-up (CU)',
    'Medium Close-up (MCU)',
    'Medium Shot (MS)',
    'Medium Long Shot (MLS)',
    'Long Shot (LS)',
    'Extreme Long Shot (ELS)'
  ],
  angle: [
    'Eye-level',
    'High angle (Bird\'s eye view)',
    'Low angle (Worm\'s eye view)',
    'Dutch angle (Tilted)',
    'Over-the-shoulder (OTS)'
  ],
  movement: [
    'Static (Fixed)',
    'Pan (Horizontal sweep)',
    'Tilt (Vertical sweep)',
    'Dolly (Push in/Pull out)',
    'Tracking (Follow subject)',
    'Crane (Up and down)'
  ],
  lighting: [
    'Natural daylight',
    'Golden hour (Warm)',
    'Blue hour (Cool)',
    'Studio lighting (3-point)',
    'Dramatic side lighting',
    'Backlit (Rim light)',
    'Soft diffused light'
  ]
};

interface CameraControlsProps {
  onSettingsChange: (settings: CameraSettings) => void;
  initialSettings?: CameraSettings;
}

const CameraControls: React.FC<CameraControlsProps> = ({ 
  onSettingsChange,
  initialSettings 
}) => {
  const [settings, setSettings] = useState<CameraSettings>(
    initialSettings || {
      shotSize: CAMERA_PRESETS.shotSize[3], // Default: Medium Shot
      angle: CAMERA_PRESETS.angle[0], // Default: Eye-level
      movement: CAMERA_PRESETS.movement[0], // Default: Static
      lighting: CAMERA_PRESETS.lighting[0] // Default: Natural daylight
    }
  );

  const handleChange = (key: keyof CameraSettings, value: string) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const resetToDefaults = () => {
    const defaults: CameraSettings = {
      shotSize: CAMERA_PRESETS.shotSize[3],
      angle: CAMERA_PRESETS.angle[0],
      movement: CAMERA_PRESETS.movement[0],
      lighting: CAMERA_PRESETS.lighting[0]
    };
    setSettings(defaults);
    onSettingsChange(defaults);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-200">📷 카메라 설정</h3>
        <button
          onClick={resetToDefaults}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition"
        >
          초기화
        </button>
      </div>
      
      {/* Shot Size */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          샷 크기 (Shot Size)
        </label>
        <select
          value={settings.shotSize}
          onChange={(e) => handleChange('shotSize', e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
        >
          {CAMERA_PRESETS.shotSize.map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          {settings.shotSize.includes('ECU') && '극단적 클로즈업 - 얼굴 일부만'}
          {settings.shotSize.includes('CU') && !settings.shotSize.includes('ECU') && !settings.shotSize.includes('MCU') && '클로즈업 - 얼굴 전체'}
          {settings.shotSize.includes('MCU') && '미디엄 클로즈업 - 가슴 위'}
          {settings.shotSize.includes('MS') && !settings.shotSize.includes('MLS') && '미디엄 샷 - 허리 위'}
          {settings.shotSize.includes('MLS') && '미디엄 롱 샷 - 무릎 위'}
          {settings.shotSize.includes('LS') && !settings.shotSize.includes('ELS') && '롱 샷 - 전신'}
          {settings.shotSize.includes('ELS') && '극단적 롱 샷 - 전체 환경'}
        </p>
      </div>

      {/* Camera Angle */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          카메라 앵글 (Camera Angle)
        </label>
        <select
          value={settings.angle}
          onChange={(e) => handleChange('angle', e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
        >
          {CAMERA_PRESETS.angle.map(angle => (
            <option key={angle} value={angle}>{angle}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          {settings.angle.includes('Eye-level') && '눈높이 - 자연스러운 시점'}
          {settings.angle.includes('High') && '하이 앵글 - 위에서 아래로 (약하게 보임)'}
          {settings.angle.includes('Low') && '로우 앵글 - 아래에서 위로 (강하게 보임)'}
          {settings.angle.includes('Dutch') && '더치 앵글 - 기울어진 (긴장감)'}
          {settings.angle.includes('Over-the-shoulder') && '어깨 너머 - 대화 장면'}
        </p>
      </div>

      {/* Camera Movement */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          카메라 무브먼트 (Camera Movement)
        </label>
        <select
          value={settings.movement}
          onChange={(e) => handleChange('movement', e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
        >
          {CAMERA_PRESETS.movement.map(movement => (
            <option key={movement} value={movement}>{movement}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          {settings.movement.includes('Static') && '고정 - 움직임 없음'}
          {settings.movement.includes('Pan') && '팬 - 좌우 회전'}
          {settings.movement.includes('Tilt') && '틸트 - 상하 회전'}
          {settings.movement.includes('Dolly') && '돌리 - 전진/후진'}
          {settings.movement.includes('Tracking') && '트래킹 - 피사체 따라가기'}
          {settings.movement.includes('Crane') && '크레인 - 상하 이동'}
        </p>
      </div>

      {/* Lighting */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          조명 (Lighting)
        </label>
        <select
          value={settings.lighting}
          onChange={(e) => handleChange('lighting', e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
        >
          {CAMERA_PRESETS.lighting.map(lighting => (
            <option key={lighting} value={lighting}>{lighting}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          {settings.lighting.includes('Natural') && '자연광 - 밝고 자연스러움'}
          {settings.lighting.includes('Golden') && '골든 아워 - 따뜻한 노을빛'}
          {settings.lighting.includes('Blue') && '블루 아워 - 차가운 저녁빛'}
          {settings.lighting.includes('Studio') && '스튜디오 조명 - 균일한 3점 조명'}
          {settings.lighting.includes('side') && '사이드 조명 - 드라마틱한 그림자'}
          {settings.lighting.includes('Backlit') && '역광 - 윤곽선 강조'}
          {settings.lighting.includes('Soft') && '소프트 조명 - 부드러운 확산광'}
        </p>
      </div>

      {/* Preview */}
      <div className="bg-gray-900 rounded-md p-3 mt-4 border border-gray-700">
        <p className="text-xs text-gray-400 mb-1 font-medium">📋 프롬프트 프리뷰:</p>
        <p className="text-sm text-gray-200 leading-relaxed">
          {settings.shotSize}, {settings.angle}, {settings.movement}, {settings.lighting}
        </p>
      </div>

      {/* Quick Presets */}
      <div className="pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-400 mb-2 font-medium">⚡ 빠른 프리셋:</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              const dramatic: CameraSettings = {
                shotSize: 'Close-up (CU)',
                angle: 'Low angle (Worm\'s eye view)',
                movement: 'Dolly (Push in/Pull out)',
                lighting: 'Dramatic side lighting'
              };
              setSettings(dramatic);
              onSettingsChange(dramatic);
            }}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-3 rounded-md transition"
          >
            🎭 드라마틱
          </button>
          <button
            onClick={() => {
              const natural: CameraSettings = {
                shotSize: 'Medium Shot (MS)',
                angle: 'Eye-level',
                movement: 'Static (Fixed)',
                lighting: 'Natural daylight'
              };
              setSettings(natural);
              onSettingsChange(natural);
            }}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-3 rounded-md transition"
          >
            🌿 자연스러움
          </button>
          <button
            onClick={() => {
              const cinematic: CameraSettings = {
                shotSize: 'Long Shot (LS)',
                angle: 'High angle (Bird\'s eye view)',
                movement: 'Crane (Up and down)',
                lighting: 'Golden hour (Warm)'
              };
              setSettings(cinematic);
              onSettingsChange(cinematic);
            }}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-3 rounded-md transition"
          >
            🎬 시네마틱
          </button>
          <button
            onClick={() => {
              const portrait: CameraSettings = {
                shotSize: 'Medium Close-up (MCU)',
                angle: 'Eye-level',
                movement: 'Static (Fixed)',
                lighting: 'Soft diffused light'
              };
              setSettings(portrait);
              onSettingsChange(portrait);
            }}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-3 rounded-md transition"
          >
            📸 인물 사진
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraControls;
