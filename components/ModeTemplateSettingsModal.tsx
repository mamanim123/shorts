import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, Save, Copy, Trash2, Upload } from 'lucide-react';
import { ModeTemplates } from '../types';

interface ModeTemplateSettingsModalProps {
  isOpen: boolean;
  templates: ModeTemplates;
  onClose: () => void;
  onSave: (templates: ModeTemplates) => void;
  onReset: () => void;
}

type TemplateTabKey = 'scriptOnly' | 'scriptImage';

const BACKUP_LIMIT = 3;

const tabItems: Array<{ key: TemplateTabKey; label: string }> = [
  { key: 'scriptOnly', label: '대본 전용 템플릿' },
  { key: 'scriptImage', label: '대본 + 이미지 템플릿' }
];

const ModeTemplateSettingsModal: React.FC<ModeTemplateSettingsModalProps> = ({
  isOpen,
  templates,
  onClose,
  onSave,
  onReset
}) => {
  const [activeTab, setActiveTab] = useState<TemplateTabKey>('scriptOnly');
  const [draft, setDraft] = useState<ModeTemplates>(templates);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedBackupSlot, setSelectedBackupSlot] = useState<number | null>(null);
  const [backupEditContent, setBackupEditContent] = useState<string>('');

  const getBackupsForTab = (tab: TemplateTabKey, data: ModeTemplates) =>
    tab === 'scriptOnly' ? (data.scriptOnlyBackups ?? []) : (data.scriptImageBackups ?? []);

  const updateBackupsForTab = (tab: TemplateTabKey, updater: (prev: string[]) => string[]) => {
    setDraft((prev) => {
      const current = getBackupsForTab(tab, prev);
      const updated = updater(current);
      return {
        ...prev,
        ...(tab === 'scriptOnly'
          ? { scriptOnlyBackups: updated }
          : { scriptImageBackups: updated })
      };
    });
  };

  useEffect(() => {
    if (isOpen) {
      setDraft({
        ...templates,
        scriptOnlyBackups: templates.scriptOnlyBackups ?? [],
        scriptImageBackups: templates.scriptImageBackups ?? []
      });
      setActiveTab('scriptOnly');
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
      setSelectedBackupSlot(null);
      setBackupEditContent('');
    }
  }, [isOpen, templates]);

  useEffect(() => {
    setSelectedBackupSlot(null);
    setBackupEditContent('');
  }, [activeTab]);

  const startDrag = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('textarea') || target.closest('button')) return;
    setDragOffset({
      x: event.clientX - position.x,
      y: event.clientY - position.y
    });
    setIsDragging(true);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: event.clientX - dragOffset.x,
      y: event.clientY - dragOffset.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleChange = (value: string) => {
    setDraft((prev) => ({
      ...prev,
      [activeTab]: value
    }));
  };

  const handleSave = () => {
    if (!draft.scriptOnly.trim() || !draft.scriptImage.trim()) {
      alert('모든 템플릿 내용을 입력해주세요.');
      return;
    }
    onSave(draft);
  };

  // 백업 슬롯 선택
  const handleSelectBackupSlot = (slotIndex: number) => {
    const backups = getBackupsForTab(activeTab, draft);
    const backupContent = backups[slotIndex];
    setSelectedBackupSlot(slotIndex);
    setBackupEditContent(backupContent || '');
  };

  // 현재 템플릿을 선택된 슬롯에 백업
  const handleBackupCurrentToSlot = () => {
    if (selectedBackupSlot === null) {
      alert('백업 슬롯을 먼저 선택해주세요.');
      return;
    }
    const content = draft[activeTab]?.trim();
    if (!content) {
      alert('백업할 템플릿 내용이 없습니다.');
      return;
    }

    updateBackupsForTab(activeTab, (prev) => {
      const updated = [...prev];
      updated[selectedBackupSlot] = content;

      const newDraft = {
        ...draft,
        ...(activeTab === 'scriptOnly'
          ? { scriptOnlyBackups: updated }
          : { scriptImageBackups: updated })
      };
      onSave(newDraft);
      return updated;
    });
    setBackupEditContent(content);
    alert(`슬롯 ${selectedBackupSlot + 1}에 백업되었습니다.`);
  };

  // 백업 편집 내용 저장
  const handleSaveBackupEdit = () => {
    if (selectedBackupSlot === null) return;
    if (!backupEditContent.trim()) {
      alert('백업 내용이 비어있습니다.');
      return;
    }

    updateBackupsForTab(activeTab, (prev) => {
      const updated = [...prev];
      updated[selectedBackupSlot] = backupEditContent;

      const newDraft = {
        ...draft,
        ...(activeTab === 'scriptOnly'
          ? { scriptOnlyBackups: updated }
          : { scriptImageBackups: updated })
      };
      onSave(newDraft);
      return updated;
    });
    alert('백업이 저장되었습니다.');
  };

  // 백업을 현재 템플릿에 적용
  const handleApplyBackup = () => {
    if (selectedBackupSlot === null) return;
    const backups = getBackupsForTab(activeTab, draft);
    const backupContent = backups[selectedBackupSlot];
    if (!backupContent) {
      alert('적용할 백업이 없습니다.');
      return;
    }

    if (!confirm('이 백업을 현재 템플릿에 적용하시겠습니까?\n(현재 작업 중인 내용이 사라집니다)')) {
      return;
    }

    setDraft((prev) => ({
      ...prev,
      [activeTab]: backupContent
    }));
    alert('백업이 적용되었습니다. "저장하기" 버튼을 눌러 템플릿에 반영하세요.');
  };

  // 백업 삭제
  const handleDeleteBackup = () => {
    if (selectedBackupSlot === null) return;
    const backups = getBackupsForTab(activeTab, draft);
    if (!backups[selectedBackupSlot]) {
      alert('삭제할 백업이 없습니다.');
      return;
    }

    if (!confirm(`슬롯 ${selectedBackupSlot + 1}의 백업을 삭제하시겠습니까?`)) return;

    updateBackupsForTab(activeTab, (prev) => {
      const updated = [...prev];
      updated[selectedBackupSlot] = '';

      const newDraft = {
        ...draft,
        ...(activeTab === 'scriptOnly'
          ? { scriptOnlyBackups: updated }
          : { scriptImageBackups: updated })
      };
      onSave(newDraft);
      return updated;
    });
    setBackupEditContent('');
    alert('백업이 삭제되었습니다.');
  };

  const currentBackups = getBackupsForTab(activeTab, draft);

  const helperText = useMemo(() => {
    return activeTab === 'scriptOnly'
      ? '대본만 생성 모드에 사용되는 프롬프트입니다. JSON 출력 형식을 포함해야 합니다.'
      : '대본 + 이미지 프롬프트 모드용 템플릿입니다. 씬/이미지 규칙을 반드시 포함하세요.';
  }, [activeTab]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-5xl h-[80vh] max-h-[90vh] bg-slate-900 text-white rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
        onMouseDown={startDrag}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 cursor-move select-none">
          <div>
            <h2 className="text-lg font-bold">생성 모드 템플릿 설정</h2>
            <p className="text-sm text-gray-400">토큰을 활용해 모드별 기본 프롬프트를 자유롭게 커스터마이징하세요.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-300"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* 왼쪽: 템플릿 편집기 */}
          <div className="md:w-2/3 border-b md:border-b-0 md:border-r border-white/5 flex flex-col">
            <div className="flex border-b border-white/5">
              {tabItems.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
                    activeTab === tab.key
                      ? 'text-purple-300 border-b-2 border-purple-400 bg-white/5'
                      : 'text-gray-400 hover:text-purple-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex-1 p-4 overflow-auto flex flex-col">
              <p className="text-xs text-gray-400 mb-3">{helperText}</p>
              <textarea
                value={draft[activeTab]}
                onChange={(e) => handleChange(e.target.value)}
                className="flex-1 resize-none bg-black/30 border border-white/10 rounded-xl p-3 font-mono text-xs text-gray-100 focus:outline-none focus:border-purple-400"
                placeholder="템플릿 내용을 입력하세요..."
              />
            </div>
          </div>

          {/* 오른쪽: 백업 관리 패널 */}
          <div className="md:w-1/3 flex flex-col bg-black/20">
            <div className="p-4 border-b border-white/10">
              <h3 className="text-sm font-bold text-white mb-1">백업 관리</h3>
              <p className="text-xs text-gray-400">
                템플릿 버전을 최대 3개까지 백업하고 관리할 수 있습니다.
              </p>
            </div>

            {/* 백업 슬롯 버튼 */}
            <div className="p-4 border-b border-white/10">
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((slotIdx) => {
                  const hasBackup = currentBackups[slotIdx]?.trim().length > 0;
                  const isSelected = selectedBackupSlot === slotIdx;
                  return (
                    <button
                      key={`slot-${slotIdx}`}
                      onClick={() => handleSelectBackupSlot(slotIdx)}
                      className={`relative h-16 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'bg-purple-500/30 border-purple-400 shadow-lg shadow-purple-500/20'
                          : hasBackup
                          ? 'bg-white/10 border-white/20 hover:border-purple-400/50'
                          : 'bg-black/20 border-white/10 border-dashed hover:border-purple-400/30'
                      }`}
                      title={hasBackup ? `백업 슬롯 ${slotIdx + 1} (저장됨)` : `백업 슬롯 ${slotIdx + 1} (비어있음)`}
                    >
                      <div className="flex flex-col items-center justify-center h-full">
                        <span className={`text-lg font-bold ${isSelected ? 'text-purple-200' : hasBackup ? 'text-white' : 'text-gray-500'}`}>
                          {slotIdx + 1}
                        </span>
                        {hasBackup && (
                          <div className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full"></div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 백업 편집 영역 */}
            {selectedBackupSlot !== null && (
              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-white">슬롯 {selectedBackupSlot + 1}</h4>
                  {currentBackups[selectedBackupSlot]?.trim() && (
                    <span className="text-xs text-green-400">● 저장됨</span>
                  )}
                </div>
                <textarea
                  value={backupEditContent}
                  onChange={(e) => setBackupEditContent(e.target.value)}
                  className="flex-1 resize-none bg-black/30 border border-white/10 rounded-lg p-2 font-mono text-xs text-gray-100 focus:outline-none focus:border-purple-400 mb-3"
                  placeholder="백업이 비어있습니다. 아래 버튼으로 현재 템플릿을 백업하세요."
                />
                <div className="space-y-2">
                  <button
                    onClick={handleBackupCurrentToSlot}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold transition"
                    title="현재 템플릿을 이 슬롯에 백업"
                  >
                    <Copy className="w-3 h-3" />
                    현재 템플릿 백업
                  </button>
                  {backupEditContent.trim() && (
                    <>
                      <button
                        onClick={handleSaveBackupEdit}
                        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-green-600/80 hover:bg-green-600 text-white text-xs font-semibold transition"
                        title="백업 편집 내용 저장"
                      >
                        <Save className="w-3 h-3" />
                        백업 저장
                      </button>
                      <button
                        onClick={handleApplyBackup}
                        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-semibold transition"
                        title="이 백업을 템플릿에 적용"
                      >
                        <Upload className="w-3 h-3" />
                        템플릿에 적용
                      </button>
                      <button
                        onClick={handleDeleteBackup}
                        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-red-400/50 text-red-300 hover:bg-red-500/20 text-xs transition"
                        title="이 백업 삭제"
                      >
                        <Trash2 className="w-3 h-3" />
                        백업 삭제
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {selectedBackupSlot === null && (
              <div className="flex-1 flex items-center justify-center p-4">
                <p className="text-xs text-gray-500 text-center">
                  백업 슬롯을 선택하여<br />
                  백업을 관리하세요
                </p>
              </div>
            )}

            {/* 하단 버튼 */}
            <div className="p-4 border-t border-white/10 flex flex-col gap-2">
              <button
                onClick={handleSave}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold"
              >
                <Save className="w-4 h-4" />
                템플릿 저장
              </button>
              <button
                onClick={onReset}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-white/20 text-gray-200 text-xs hover:border-purple-300"
              >
                <RotateCcw className="w-4 h-4" />
                기본값으로 초기화
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 rounded-lg text-xs text-gray-400 hover:text-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
};

export default ModeTemplateSettingsModal;
