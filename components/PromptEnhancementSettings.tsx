import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Play, Sparkles, Trash2, Plus, Wand2, Copy } from 'lucide-react';
import { enhancePrompt } from './master-studio/services/geminiService';
import {
  DEFAULT_PROMPT_ENHANCEMENT_SETTINGS,
  normalizePromptEnhancementSettings,
  createPromptEnhancementSlot,
  clonePromptEnhancementSettings,
  NormalizedPromptEnhancementSettings,
  PromptEnhancementSlot,
} from '../services/promptEnhancementUtils';

interface PromptEnhancementSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EnhancementProfile {
  id: string;
  name: string;
  settings: NormalizedPromptEnhancementSettings;
}

interface SettingsPayload {
  activeProfileId: string;
  profiles: EnhancementProfile[];
}

const createProfileId = () => `profile-${Math.random().toString(36).slice(2, 10)}`;

const parseSettingsResponse = (data: any): SettingsPayload => {
  if (data && Array.isArray(data.profiles) && data.profiles.length) {
    const normalizedProfiles = data.profiles.map((profile: any, index: number) => ({
      id: profile.id || createProfileId(),
      name: profile.name || `옵션 ${index + 1}`,
      settings: normalizePromptEnhancementSettings(profile.settings || profile),
    }));
    const fallbackId = normalizedProfiles[0].id;
    const activeId =
      data.activeProfileId && normalizedProfiles.some((profile) => profile.id === data.activeProfileId)
        ? data.activeProfileId
        : fallbackId;
    return {
      profiles: normalizedProfiles,
      activeProfileId: activeId,
    };
  }

  const defaultProfile: EnhancementProfile = {
    id: createProfileId(),
    name: '기본 옵션',
    settings: normalizePromptEnhancementSettings(data),
  };

  return {
    profiles: [defaultProfile],
    activeProfileId: defaultProfile.id,
  };
};

const createDefaultProfile = (): EnhancementProfile => ({
  id: createProfileId(),
  name: '기본 옵션',
  settings: clonePromptEnhancementSettings(DEFAULT_PROMPT_ENHANCEMENT_SETTINGS),
});

export const PromptEnhancementSettings: React.FC<PromptEnhancementSettingsProps> = ({
  isOpen,
  onClose,
}) => {
  const [profiles, setProfiles] = useState<EnhancementProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testPrompt, setTestPrompt] = useState('A woman in a cafe');
  const [testResult, setTestResult] = useState('');
  const [slotPreviews, setSlotPreviews] = useState<Record<string, string>>({});
  const [slotDrafts, setSlotDrafts] = useState<Record<string, string>>({});
  const [previewingSlotId, setPreviewingSlotId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!profiles.length) {
      const defaultProfile = createDefaultProfile();
      setProfiles([defaultProfile]);
      setActiveProfileId(defaultProfile.id);
      setSelectedProfileId(defaultProfile.id);
    } else if (!selectedProfileId) {
      const nextId = activeProfileId && profiles.some((profile) => profile.id === activeProfileId)
        ? activeProfileId
        : profiles[0].id;
      setSelectedProfileId(nextId);
    }
  }, [profiles, activeProfileId, selectedProfileId]);

  useEffect(() => {
    setSlotPreviews({});
    setSlotDrafts({});
  }, [selectedProfileId]);

  const currentProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId),
    [profiles, selectedProfileId]
  );

  const currentSettings =
    currentProfile?.settings ?? DEFAULT_PROMPT_ENHANCEMENT_SETTINGS;

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:3002/api/prompt-enhancement-settings');
      if (res.ok) {
        const data = await res.json();
        const parsed = parseSettingsResponse(data);
        setProfiles(parsed.profiles);
        setActiveProfileId(parsed.activeProfileId);
        setSelectedProfileId(parsed.activeProfileId);
      } else {
        const fallback = createDefaultProfile();
        setProfiles([fallback]);
        setActiveProfileId(fallback.id);
        setSelectedProfileId(fallback.id);
      }
    } catch (error) {
      console.error('Failed to load settings', error);
      const fallback = createDefaultProfile();
      setProfiles([fallback]);
      setActiveProfileId(fallback.id);
      setSelectedProfileId(fallback.id);
    } finally {
      setIsLoading(false);
    }
  };

  const buildPayload = (overrideActiveId?: string) => {
    const profileList = profiles.length ? profiles : [createDefaultProfile()];
    const resolvedActiveId =
      (overrideActiveId && profileList.some((profile) => profile.id === overrideActiveId) && overrideActiveId) ||
      (profileList.some((profile) => profile.id === activeProfileId) ? activeProfileId : profileList[0].id);
    return {
      activeProfileId: resolvedActiveId,
      profiles: profileList,
    };
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = buildPayload();
      const res = await fetch('http://localhost:3002/api/prompt-enhancement-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        alert('설정이 저장되었습니다.');
        onClose();
      } else {
        alert('저장 실패');
      }
    } catch (error) {
      console.error('Failed to save settings', error);
      alert('저장 중 오류 발생');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const payload = buildPayload(selectedProfileId);
      await fetch('http://localhost:3002/api/prompt-enhancement-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const enhanced = await enhancePrompt(testPrompt);
      setTestResult(enhanced);
    } catch (error) {
      console.error('Test failed', error);
    } finally {
      setIsTesting(false);
    }
  };

  const updateCurrentSettings = (
    updater: (prev: NormalizedPromptEnhancementSettings) => NormalizedPromptEnhancementSettings
  ) => {
    if (!currentProfile) return;
    setProfiles((prev) =>
      prev.map((profile) => {
        if (profile.id !== currentProfile.id) return profile;
        const nextSettings = normalizePromptEnhancementSettings(updater(profile.settings));
        return { ...profile, settings: nextSettings };
      })
    );
  };

  const addSlot = () => {
    const slot = createPromptEnhancementSlot({
      label: `슬롯 ${(currentSettings.slots || []).length + 1}`,
      keywords: [],
    });
    updateCurrentSettings((prev) => ({ ...prev, slots: [...prev.slots, slot] }));
  };

  const updateSlot = (slotId: string, changes: Partial<PromptEnhancementSlot>) => {
    updateCurrentSettings((prev) => ({
      ...prev,
      slots: prev.slots.map((slot) =>
        slot.id === slotId ? { ...slot, ...changes } : slot
      ),
    }));
    setSlotPreviews((prev) => {
      if (!prev[slotId]) return prev;
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  };

  const updateSlotKeywords = (slotId: string, text: string) => {
    setSlotDrafts((prev) => ({ ...prev, [slotId]: text }));
    const keywords = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    updateSlot(slotId, { keywords });
  };

  const clearSlotDraft = (slotId: string) => {
    setSlotDrafts((prev) => {
      if (!prev[slotId]) return prev;
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  };

  const removeSlot = (slotId: string) => {
    updateCurrentSettings((prev) => ({
      ...prev,
      slots: prev.slots.filter((slot) => slot.id !== slotId),
    }));
    setSlotPreviews((prev) => {
      if (!prev[slotId]) return prev;
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  };

  const handlePreviewSentence = async (slot: PromptEnhancementSlot) => {
    setPreviewingSlotId(slot.id);
    try {
      const res = await fetch('http://localhost:3002/api/prompt-enhancement-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slot),
      });
      if (res.ok) {
        const data = await res.json();
        setSlotPreviews((prev) => ({ ...prev, [slot.id]: data.sentence || '' }));
      } else {
        alert('문장을 생성하지 못했습니다.');
      }
    } catch (error) {
      console.error('Failed to preview sentence', error);
    } finally {
      setPreviewingSlotId(null);
    }
  };

  const handleAddProfile = () => {
    const baseSettings = currentProfile
      ? clonePromptEnhancementSettings(currentProfile.settings)
      : clonePromptEnhancementSettings(DEFAULT_PROMPT_ENHANCEMENT_SETTINGS);
    const newProfile: EnhancementProfile = {
      id: createProfileId(),
      name: `옵션 ${profiles.length + 1}`,
      settings: baseSettings,
    };
    setProfiles((prev) => [...prev, newProfile]);
    setSelectedProfileId(newProfile.id);
  };

  const handleDeleteProfile = () => {
    if (!currentProfile || profiles.length <= 1) {
      alert('최소 한 개의 옵션은 유지되어야 합니다.');
      return;
    }
    if (!window.confirm(`"${currentProfile.name}" 옵션을 삭제할까요?`)) return;
    const remaining = profiles.filter((profile) => profile.id !== currentProfile.id);
    setProfiles(remaining);
    const nextSelected = remaining[0]?.id || '';
    setSelectedProfileId(nextSelected);
    if (activeProfileId === currentProfile.id && nextSelected) {
      setActiveProfileId(nextSelected);
    }
  };

  const handleSetActiveProfile = () => {
    if (!selectedProfileId) return;
    setActiveProfileId(selectedProfileId);
  };

  const handleRenameProfile = (name: string) => {
    if (!currentProfile) return;
    setProfiles((prev) =>
      prev.map((profile) =>
        profile.id === currentProfile.id ? { ...profile, name } : profile
      )
    );
  };

  const renderSlot = (slot: PromptEnhancementSlot, index: number) => {
    const previewText = slotPreviews[slot.id];
    return (
      <div
        key={slot.id}
        className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">슬롯 이름</label>
            <input
              type="text"
              value={slot.label}
              onChange={(e) => updateSlot(slot.id, { label: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder={`슬롯 ${index + 1}`}
            />
          </div>
          <label className="text-xs text-slate-400 flex items-center gap-2">
            <span>사용</span>
            <input
              type="checkbox"
              checked={slot.enabled}
              onChange={(e) => updateSlot(slot.id, { enabled: e.target.checked })}
              className="w-5 h-5 rounded border-slate-600 text-purple-600 focus:ring-purple-500 bg-slate-800"
            />
          </label>
          <button
            className="text-slate-500 hover:text-red-400 transition-colors"
            onClick={() => removeSlot(slot.id)}
            title="슬롯 삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">키워드 (줄바꿈으로 구분)</label>
          <textarea
            value={slotDrafts[slot.id] ?? (slot.keywords || []).join('\n')}
            onChange={(e) => updateSlotKeywords(slot.id, e.target.value)}
            onBlur={() => clearSlotDraft(slot.id)}
            className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none"
            placeholder="예: Sculpted hourglass silhouette"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={slot.autoSentence}
              onChange={(e) => updateSlot(slot.id, { autoSentence: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 text-purple-600 focus:ring-purple-500 bg-slate-800"
            />
            단어로 자연스러운 문장 만들기
          </label>
          <input
            type="text"
            value={slot.customSentence || ''}
            onChange={(e) => updateSlot(slot.id, { customSentence: e.target.value })}
            placeholder="직접 문장을 입력하면 우선 적용됩니다."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-1"
            onClick={() => handlePreviewSentence(slot)}
            disabled={previewingSlotId === slot.id}
          >
            <Wand2 className="w-3 h-3" />
            {previewingSlotId === slot.id ? '생성 중...' : '문장 미리보기'}
          </button>
          <span className="text-xs text-slate-400">
            {previewText ? previewText : '작성된 문장이 여기에 표시됩니다.'}
          </span>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const isActiveProfile = currentProfile && currentProfile.id === activeProfileId;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            프롬프트 후처리 설정 (Enhancement Settings)
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {isLoading ? (
            <div className="text-center py-20 text-slate-400">로딩 중...</div>
          ) : (
            <>
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-400">옵션 선택</label>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      value={selectedProfileId}
                      onChange={(e) => setSelectedProfileId(e.target.value)}
                      className="flex-1 min-w-[180px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                          {profile.id === activeProfileId ? ' (사용 중)' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-1"
                      onClick={handleAddProfile}
                    >
                      <Copy className="w-3 h-3" />
                      옵션 복제
                    </button>
                    <button
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-700/80 hover:bg-rose-700 text-white flex items-center gap-1 disabled:opacity-40"
                      onClick={handleDeleteProfile}
                      disabled={profiles.length <= 1}
                    >
                      <Trash2 className="w-3 h-3" />
                      삭제
                    </button>
                  </div>
                </div>
                {currentProfile && (
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-slate-400 mb-1 block">옵션 이름</label>
                      <input
                        type="text"
                        value={currentProfile.name}
                        onChange={(e) => handleRenameProfile(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <button
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white"
                      onClick={handleSetActiveProfile}
                      disabled={isActiveProfile}
                    >
                      {isActiveProfile ? '사용 중' : '이 옵션 사용'}
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-purple-300 flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      대본 생성 시 자동 후처리 적용
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      꺼두시면 대본 생성 시에는 원본 프롬프트가 유지되며, 필요할 때 '전체 후처리' 버튼으로 적용할 수 있습니다.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentSettings.autoEnhanceOnGeneration}
                      onChange={(e) =>
                        updateCurrentSettings((prev) => ({ ...prev, autoEnhanceOnGeneration: e.target.checked }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="pt-3 border-t border-purple-500/20 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                      <Wand2 className="w-4 h-4" />
                      성별 의상 보호 (Gender Guard)
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      남성 캐릭터가 여성용 의상(치마, 드레스 등)을 입는 것을 방지하고 고정 의상으로 교정합니다.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentSettings.useGenderGuard}
                      onChange={(e) =>
                        updateCurrentSettings((prev) => ({ ...prev, useGenderGuard: e.target.checked }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    사용자 정의 슬롯
                  </h3>
                  <button
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-1"
                    onClick={addSlot}
                  >
                    <Plus className="w-3 h-3" />
                    슬롯 추가
                  </button>
                </div>
                {currentSettings.slots.length === 0 && (
                  <p className="text-xs text-slate-500">
                    슬롯이 없습니다. ‘슬롯 추가’ 버튼을 눌러 원하는 요소(국적, 체형, 의상 등)를 추가하세요.
                  </p>
                )}
                <div className="space-y-3">
                  {currentSettings.slots.map((slot, idx) => renderSlot(slot, idx))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-lg font-semibold text-blue-300 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={currentSettings.useQualityTags}
                      onChange={(e) =>
                        updateCurrentSettings((prev) => ({ ...prev, useQualityTags: e.target.checked }))
                      }
                      className="w-5 h-5 rounded border-slate-600 text-blue-600 focus:ring-blue-500 bg-slate-800"
                    />
                    고화질/품질 태그 (Quality Tags)
                  </label>
                  <span className="text-xs text-slate-500">항상 마지막에 추가</span>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">추가할 태그 문자열</p>
                  <input
                    type="text"
                    value={currentSettings.qualityTags}
                    onChange={(e) =>
                      updateCurrentSettings((prev) => ({ ...prev, qualityTags: e.target.value }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    disabled={!currentSettings.useQualityTags}
                  />
                </div>
              </div>

              <div className="border-t border-slate-700 pt-6">
                <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
                  <Play className="w-4 h-4 text-green-400" />
                  테스트 (Preview)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">입력 프롬프트</label>
                    <textarea
                      value={testPrompt}
                      onChange={(e) => setTestPrompt(e.target.value)}
                      className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 focus:ring-2 focus:ring-green-500 outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">결과 (Enhanced)</label>
                    <div className="w-full h-32 bg-black/50 border border-slate-700 rounded-lg p-3 text-sm text-green-300 overflow-y-auto">
                      {testResult || <span className="text-slate-600 italic">테스트 버튼을 눌러보세요</span>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleTest}
                  disabled={isTesting}
                  className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isTesting ? '처리 중...' : '테스트 실행 (Test)'}
                </button>
                <p className="text-xs text-slate-500 mt-2">
                  * 테스트 실행 시 현재 옵션이 서버에 임시 저장되어 적용됩니다.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-slate-300 font-bold hover:bg-slate-700 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:shadow-lg hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '설정 저장 (Save)'}
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
