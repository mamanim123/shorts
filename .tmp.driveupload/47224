import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Save, Copy, Trash2, Loader2, RefreshCw } from 'lucide-react';
import {
  fetchPromptPresetDetail,
  fetchPromptPresets,
  createPromptPreset,
  updatePromptPreset,
  deletePromptPreset
} from '../services/promptPresetService';
import { PromptPresetSummary, PromptPreset } from '../types';

interface PromptPresetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (presets: PromptPresetSummary[], activeId?: string) => void;
  defaultPresetId?: string;
  darkMode?: boolean;
}

const BLANK_PRESET: PromptPreset = {
  id: '',
  name: '',
  description: '',
  content: ''
};

export const PromptPresetManagerModal: React.FC<PromptPresetManagerModalProps> = ({
  isOpen,
  onClose,
  onUpdated,
  defaultPresetId,
  darkMode = false
}) => {
  const [presets, setPresets] = useState<PromptPresetSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [form, setForm] = useState<PromptPreset>(BLANK_PRESET);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingPreset, setLoadingPreset] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPresets(defaultPresetId);
      setDragPosition({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [isOpen, defaultPresetId]);

  const startDrag = (event: React.MouseEvent) => {
    setDragOffset({
      x: event.clientX - dragPosition.x,
      y: event.clientY - dragPosition.y
    });
    setIsDragging(true);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return;
    setDragPosition({
      x: event.clientX - dragOffset.x,
      y: event.clientY - dragOffset.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const loadPresets = async (preferredId?: string) => {
    setLoadingList(true);
    const list = await fetchPromptPresets();
    setPresets(list);
    const nextId =
      preferredId && list.some((preset) => preset.id === preferredId)
        ? preferredId
        : list[0]?.id || '';
    if (nextId) {
      loadPresetDetail(nextId);
    } else {
      setForm(BLANK_PRESET);
    }
    setSelectedId(nextId);
    setLoadingList(false);
  };

  const loadPresetDetail = async (id: string) => {
    if (!id) {
      setForm(BLANK_PRESET);
      return;
    }
    setLoadingPreset(true);
    const detail = await fetchPromptPresetDetail(id);
    if (detail) {
      setForm(detail);
    } else {
      setForm(BLANK_PRESET);
    }
    setLoadingPreset(false);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    loadPresetDetail(id);
  };

  const handleNew = () => {
    setSelectedId('');
    setForm(BLANK_PRESET);
  };

  const handleDuplicate = async () => {
    if (!form.id || !form.content) {
      alert('복제할 프리셋을 먼저 선택하세요.');
      return;
    }
    setSaving(true);
    const duplicate = await createPromptPreset({
      name: `${form.name || '새 프리셋'} 복제`,
      description: form.description,
      content: form.content
    });
    setSaving(false);
    if (!duplicate) {
      alert('프리셋 복제에 실패했습니다.');
      return;
    }
    await loadPresets(duplicate.id);
    if (onUpdated) {
      onUpdated(await fetchPromptPresets(), duplicate.id);
    }
    alert('복제된 프리셋을 선택했습니다. 이름을 수정하고 저장하세요.');
  };

  const handleChange = (key: keyof PromptPreset, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.content || !form.content.trim()) {
      alert('프리셋 내용은 필수입니다.');
      return;
    }
    setSaving(true);
    let result: PromptPreset | null = null;
    if (form.id) {
      result = await updatePromptPreset(form.id, {
        id: form.id,
        name: form.name || '이름 없는 프리셋',
        description: form.description,
        content: form.content
      });
    } else {
      result = await createPromptPreset({
        name: form.name || '새 프리셋',
        description: form.description,
        content: form.content
      });
    }
    setSaving(false);
    if (!result) {
      alert('프리셋 저장에 실패했습니다.');
      return;
    }
    await loadPresets(result.id);
    if (onUpdated) {
      onUpdated(await fetchPromptPresets(), result.id);
    }
    alert('프리셋이 저장되었습니다.');
  };

  const handleDelete = async () => {
    if (!form.id) return;
    if (!window.confirm('이 프리셋을 삭제하시겠습니까?')) return;
    setDeleting(true);
    const success = await deletePromptPreset(form.id);
    setDeleting(false);
    if (!success) {
      alert('삭제 실패');
      return;
    }
    await loadPresets();
    if (onUpdated) {
      onUpdated(await fetchPromptPresets());
    }
    alert('삭제되었습니다.');
  };

  const presetTitle = useMemo(() => {
    if (form.id) return `프리셋 편집: ${form.name || form.id}`;
    return '새 프리셋 작성';
  }, [form]);

  if (!isOpen) return null;

  const content = (
    <div className={darkMode ? 'dark' : ''}>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          ref={modalRef}
          className="bg-white dark:bg-gray-900 rounded-xl w-[95%] max-w-[900px] h-[85vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700"
          style={{
            transform: `translate(${dragPosition.x}px, ${dragPosition.y}px)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          <div
            className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between cursor-move bg-gray-50 dark:bg-gray-800 rounded-t-xl select-none"
            onMouseDown={startDrag}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">프리셋 관리</h2>
              {loadingList && <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />}
            </div>
            <button
              onClick={onClose}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
              title="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <aside className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col">
              <div className="p-3 flex gap-2">
                <button
                  onClick={() => loadPresets(selectedId)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                >
                  <RefreshCw className="w-3 h-3" />
                  새로고침
                </button>
                <button
                  onClick={handleNew}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white"
                >
                  <Plus className="w-3 h-3" />
                  새 프리셋
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelect(preset.id)}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-gray-200 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-800 ${preset.id === selectedId ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    <div className="font-semibold truncate">{preset.name}</div>
                    {preset.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{preset.description}</div>
                    )}
                  </button>
                ))}
                {!presets.length && (
                  <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">등록된 프리셋이 없습니다.</div>
                )}
              </div>
            </aside>
            <main className="flex-1 flex flex-col bg-white dark:bg-gray-900">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{presetTitle}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">LLM에 전달될 고정 메타 프롬프트를 저장해두세요.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDuplicate}
                    disabled={!form.id || !form.content}
                    className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1 disabled:opacity-40"
                  >
                    <Copy className="w-3 h-3" />
                    복제
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={!form.id || deleting}
                    className="px-3 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center gap-1 disabled:opacity-40"
                  >
                    {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    삭제
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingPreset ? (
                  <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    프리셋을 불러오는 중입니다...
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">프리셋 이름</label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => handleChange('name', e.target.value)}
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 outline-none"
                          placeholder="중년 로맨스 구조 엔진"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">설명</label>
                        <input
                          type="text"
                          value={form.description}
                          onChange={(e) => handleChange('description', e.target.value)}
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 outline-none"
                          placeholder="중년 설렘/금기 쇼츠 대본 매크로"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">매크로 내용</label>
                      <textarea
                        value={form.content}
                        onChange={(e) => handleChange('content', e.target.value)}
                        className="w-full min-h-[320px] bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                        placeholder="LLM에게 전달할 전체 매크로를 작성하세요."
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between rounded-b-xl">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {form.content ? `길이: ${form.content.length.toLocaleString()}자` : '내용 없음'}
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  저장
                </button>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? content : createPortal(content, document.body);
};

export default PromptPresetManagerModal;
