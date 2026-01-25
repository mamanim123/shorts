import React from 'react';
import { User, Lock, Unlock, Sparkles, X } from 'lucide-react';

export interface CharacterIdentity {
  id: string;
  slotId: string; // Woman A, B, C, D, Man A, B
  name: string;
  age: string;
  outfit: string;
  accessories: string;
  image?: string;
  isLocked: boolean;
  lockedFields: Set<string>;
}

interface AccessoryGroup {
  id?: string;
  label: string;
  items: string[];
}

interface ShortsIdentityCardProps {
  identity: CharacterIdentity;
  onUpdate: (id: string, updates: Partial<CharacterIdentity>) => void;
  onDelete: (id: string) => void;
  outfitPresets: { id?: string; name: string; translation: string; imageUrl?: string }[];
  accessoryGroups?: AccessoryGroup[];
  winterAccessoryOptions?: string[];
  showAccessoryGallery?: boolean;
  showOutfitGallery?: boolean;
}

const SLOT_OPTIONS = [
  { id: 'Woman A', label: 'Woman A (긴 웨이브, 글래머)', desc: 'Long soft-wave hairstyle, voluptuous hourglass figure' },
  { id: 'Woman B', label: 'Woman B (숏컷/단발, 슬림)', desc: 'Short chic bob cut, petite and alluring aura' },
  { id: 'Woman C', label: 'Woman C (포니테일, 스포티)', desc: 'Low ponytail, athletic and calm demeanor' },
  { id: 'Woman D', label: 'Woman D (캐디, 단정)', desc: 'Neat ponytail, slim and professional demeanor' },
  { id: 'Man A', label: 'Man A (깔끔한 컷, 근육질)', desc: 'Short neat hairstyle, fit athletic build' },
  { id: 'Man B', label: 'Man B (댄디 컷, 체격 좋음)', desc: 'Clean short cut, well-built dandy physique' },
];

const AGE_OPTIONS = ['20대', '30대', '40대', '50대', '60대', '70대'];

export const ShortsIdentityCard: React.FC<ShortsIdentityCardProps> = ({
  identity,
  onUpdate,
  onDelete,
  outfitPresets,
  accessoryGroups = [],
  winterAccessoryOptions = [],
  showAccessoryGallery = false,
  showOutfitGallery = false,
}) => {
  const toggleFieldLock = (field: string) => {
    const newLockedFields = new Set(identity.lockedFields);
    if (newLockedFields.has(field)) {
      newLockedFields.delete(field);
    } else {
      newLockedFields.add(field);
    }
    onUpdate(identity.id, { lockedFields: newLockedFields });
  };

  const isFieldLocked = (field: string) => identity.lockedFields.has(field);

  const selectedSlot = SLOT_OPTIONS.find(s => s.id === identity.slotId);
  const selectedAccessories = identity.accessories
    ? identity.accessories.split(',').map(item => item.trim()).filter(Boolean)
    : [];
  const [accessoryTab, setAccessoryTab] = React.useState<'general' | 'winter'>('general');

  const toggleAccessoryOption = (value: string) => {
    const next = new Set(selectedAccessories);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onUpdate(identity.id, { accessories: Array.from(next).join(', ') });
  };

  const getAccessoryEmoji = (value: string) => {
    const lower = value.toLowerCase();
    if (lower.includes('ring')) return '💍';
    if (lower.includes('necklace') || lower.includes('choker') || lower.includes('pendant')) return '📿';
    if (lower.includes('watch') || lower.includes('bracelet') || lower.includes('bangle')) return '⌚';
    if (lower.includes('earring')) return '💎';
    return '✨';
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 bg-white dark:bg-slate-900/60 shadow-lg transition-all hover:border-purple-500/30 group">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${identity.isLocked ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
            <User size={16} />
          </div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {identity.slotId || '새 캐릭터'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={identity.isLocked}
              onChange={(e) => onUpdate(identity.id, { isLocked: e.target.checked })}
              className="rounded border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-purple-600 focus:ring-purple-500"
            />
            <span className={identity.isLocked ? 'text-purple-400' : 'text-slate-500'}>인물 고정</span>
          </label>
          <button
            onClick={() => onDelete(identity.id)}
            className="text-slate-500 hover:text-red-400 transition-colors p-1"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-4">
        {/* Profile Image Area */}
        <div className="shrink-0">
          <div className="relative group/img">
            {identity.image ? (
              <img
                src={identity.image}
                className="h-20 w-20 rounded-xl object-cover border-2 border-purple-500/50 shadow-md"
                alt={identity.name}
              />
            ) : (
              <div className="h-20 w-20 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all cursor-pointer">
                <span className="text-xl">👤</span>
                <span className="text-[9px] font-medium">IMAGE</span>
              </div>
            )}
          </div>
        </div>

        {/* Inputs Area */}
        <div className="flex-1 space-y-2">
          {/* Name & Age Row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <input
                type="text"
                value={identity.name}
                onChange={(e) => onUpdate(identity.id, { name: e.target.value })}
                placeholder="이름 (예: 수아)"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-700 dark:text-white focus:ring-1 focus:ring-purple-500 outline-none"
              />
            </div>
            <select
              value={identity.age}
              onChange={(e) => onUpdate(identity.id, { age: e.target.value })}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">나이 선택</option>
              {AGE_OPTIONS.map(age => <option key={age} value={age}>{age}</option>)}
            </select>
          </div>

          {/* Slot Selection */}
          <select
            value={identity.slotId}
            onChange={(e) => onUpdate(identity.id, { slotId: e.target.value })}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs text-purple-400 font-bold outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="">선택안함</option>
            <option value="">캐릭터 슬롯 선택 (Woman A/B/C...)</option>
            {SLOT_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
          </select>
        </div>
      </div>

      {/* Detail Fields (Outfit & Accessories) */}
      <div className="space-y-2 pt-1">
        {/* Outfit Field */}
        {showOutfitGallery ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-[10px] text-slate-300">
            <span className="text-slate-400">의상 설정</span>
            <div className="flex items-center gap-2">
              <span className="truncate max-w-[160px]">{identity.outfit || '미선택'}</span>
              <button
                onClick={() => toggleFieldLock('outfit')}
                className={`p-1 rounded-lg transition-colors ${isFieldLocked('outfit') ? 'text-purple-400 bg-purple-500/10' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                {isFieldLocked('outfit') ? <Lock size={12} /> : <Unlock size={12} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                list={`outfit-presets-${identity.id}`}
                value={identity.outfit}
                onChange={(e) => onUpdate(identity.id, { outfit: e.target.value })}
                placeholder="의상 설정 (예: 화이트 미니 드레스)"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-purple-500"
              />
              <datalist id={`outfit-presets-${identity.id}`}>
                {outfitPresets.map((p, i) => (
                  <option key={i} value={p.name}>{p.translation}</option>
                ))}
              </datalist>
            </div>
            <button
              onClick={() => toggleFieldLock('outfit')}
              className={`p-1.5 rounded-lg transition-colors ${isFieldLocked('outfit') ? 'text-purple-400 bg-purple-500/10' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              {isFieldLocked('outfit') ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>
        )}

        {showOutfitGallery && outfitPresets.length > 0 && (
          <details className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
            <summary className="text-[10px] text-slate-400 font-semibold cursor-pointer select-none">
              의상 리스트 (썸네일)
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => onUpdate(identity.id, { outfit: '' })}
                className={`flex flex-col items-start gap-1 rounded-lg border p-2 text-left transition-all ${
                  !identity.outfit
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="w-full h-16 rounded-md border border-dashed border-slate-800 flex items-center justify-center text-[9px] text-slate-600">
                  선택안함
                </div>
                <span className="text-[9px] text-slate-400 truncate w-full">의상 초기화</span>
              </button>
              {outfitPresets.map((preset, index) => (
                <button
                  type="button"
                  key={preset.id || `${preset.name}-${index}`}
                  onClick={() => onUpdate(identity.id, { outfit: preset.name })}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-2 text-left transition-all ${
                    identity.outfit === preset.name
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {preset.imageUrl ? (
                    <img
                      src={preset.imageUrl}
                      alt={preset.translation || preset.name}
                      className="w-full h-16 rounded-md object-cover border border-slate-800"
                    />
                  ) : (
                    <div className="w-full h-16 rounded-md border border-dashed border-slate-800 flex items-center justify-center text-[9px] text-slate-600">
                      NO IMAGE
                    </div>
                  )}
                  <span className="text-[9px] text-slate-300 truncate w-full">
                    {preset.translation || preset.name}
                  </span>
                </button>
              ))}
            </div>
          </details>
        )}

        {/* Accessories Field */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={identity.accessories}
            onChange={(e) => onUpdate(identity.id, { accessories: e.target.value })}
            placeholder="악세서리 (예: 다이아몬드 시계)"
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-purple-500"
          />
          <button
            onClick={() => toggleFieldLock('accessories')}
            className={`p-1.5 rounded-lg transition-colors ${isFieldLocked('accessories') ? 'text-purple-400 bg-purple-500/10' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            {isFieldLocked('accessories') ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
        </div>

        {showAccessoryGallery && (accessoryGroups.length > 0 || winterAccessoryOptions.length > 0) && (
          <details className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
            <summary className="text-[10px] font-semibold text-slate-400 cursor-pointer select-none">
              악세서리 리스트 (썸네일)
            </summary>
            <div className="mt-2">
              <div className="flex gap-1 rounded-full bg-slate-900 p-0.5 border border-slate-800 w-fit mb-2">
                <button
                  type="button"
                  onClick={() => setAccessoryTab('general')}
                  className={`px-2 py-0.5 text-[9px] font-bold rounded-full transition-all ${
                    accessoryTab === 'general'
                      ? 'bg-purple-500 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  일반
                </button>
                <button
                  type="button"
                  onClick={() => setAccessoryTab('winter')}
                  disabled={winterAccessoryOptions.length === 0}
                  className={`px-2 py-0.5 text-[9px] font-bold rounded-full transition-all ${
                    winterAccessoryOptions.length === 0
                      ? 'text-slate-600 cursor-not-allowed'
                      : accessoryTab === 'winter'
                      ? 'bg-purple-500 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  겨울
                </button>
              </div>

              <button
                type="button"
                onClick={() => onUpdate(identity.id, { accessories: '' })}
                className="mb-2 px-2 py-1 text-[9px] rounded-full border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-all"
              >
                선택안함 (초기화)
              </button>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {accessoryTab === 'general' && (
                  <div className="space-y-2">
                    {accessoryGroups.map((group, groupIndex) => (
                      <div key={`${group.label}-${groupIndex}`}>
                        <div className="text-[9px] text-slate-500 mb-1">{group.label}</div>
                        <div className="grid grid-cols-2 gap-2">
                          {group.items.map((option) => {
                            const isSelected = selectedAccessories.includes(option);
                            return (
                              <button
                                type="button"
                                key={`${identity.id}-${option}`}
                                onClick={() => toggleAccessoryOption(option)}
                                className={`flex items-center gap-2 rounded-md border px-2 py-1 text-[9px] transition-all ${
                                  isSelected
                                    ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                                    : 'border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                                }`}
                              >
                                <span className="w-5 h-5 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px]">
                                  {getAccessoryEmoji(option)}
                                </span>
                                <span className="truncate">{option}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {accessoryTab === 'winter' && (
                  <div className="grid grid-cols-2 gap-2">
                    {winterAccessoryOptions.map((option) => {
                      const isSelected = selectedAccessories.includes(option);
                      return (
                        <button
                          type="button"
                          key={`${identity.id}-winter-${option}`}
                          onClick={() => toggleAccessoryOption(option)}
                          className={`flex items-center gap-2 rounded-md border px-2 py-1 text-[9px] transition-all ${
                            isSelected
                              ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                              : 'border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                          }`}
                        >
                          <span className="w-5 h-5 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px]">
                            {getAccessoryEmoji(option)}
                          </span>
                          <span className="truncate">{option}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </details>
        )}
      </div>

      {/* AI Visual Hint */}
      {selectedSlot && (
        <div className="bg-purple-500/5 rounded-lg p-2 border border-purple-500/10">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={10} className="text-purple-400" />
            <span className="text-[9px] font-bold text-purple-400 uppercase tracking-tight">AI Visual Guide</span>
          </div>
          <p className="text-[10px] text-slate-500 italic leading-tight">
            {selectedSlot.desc}
          </p>
        </div>
      )}
    </div>
  );
};
