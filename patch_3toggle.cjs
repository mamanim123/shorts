const fs = require('fs');

const path = './components/ShortsLabPanel.tsx';
let s = fs.readFileSync(path, 'utf8');

// 1) state 추가
if (!s.includes('useRawLlmParsing')) {
  s = s.replace(
    'const [useRandomOutfits, setUseRandomOutfits] = useState(true);',
    'const [useRandomOutfits, setUseRandomOutfits] = useState(true);\n    const [useRawLlmParsing, setUseRawLlmParsing] = useState(false);'
  );
}

// 2) input 탭 토글 영역 교체
const re = /\{activeTab === 'input' && \(\s*<div className="space-y-2">[\s\S]*?<\/div>\s*\)\}/;

const newBlock = `{activeTab === 'input' && (
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="flex items-center justify-between p-2 bg-slate-800/50 border border-slate-700 rounded-lg">
                                        <span className="text-xs font-medium text-slate-300">겨울아이템</span>
                                        <button
                                            onClick={() => setEnableWinterAccessories(!enableWinterAccessories)}
                                            className={\`relative inline-flex h-5 w-9 items-center rounded-full transition-colors \${enableWinterAccessories ? 'bg-purple-600' : 'bg-slate-700'}\`}
                                        >
                                            <span className={\`inline-block h-3 w-3 transform rounded-full bg-white transition-transform \${enableWinterAccessories ? 'translate-x-5' : 'translate-x-1'}\`} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between p-2 bg-slate-800/50 border border-slate-700 rounded-lg">
                                        <span className="text-xs font-medium text-slate-300">의상LLM</span>
                                        <button
                                            onClick={() => setUseRandomOutfits(!useRandomOutfits)}
                                            className={\`relative inline-flex h-5 w-9 items-center rounded-full transition-colors \${!useRandomOutfits ? 'bg-emerald-600' : 'bg-slate-700'}\`}
                                        >
                                            <span className={\`inline-block h-3 w-3 transform rounded-full bg-white transition-transform \${!useRandomOutfits ? 'translate-x-5' : 'translate-x-1'}\`} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between p-2 bg-slate-800/50 border border-slate-700 rounded-lg">
                                        <span className="text-xs font-medium text-slate-300">LLM파싱</span>
                                        <button
                                            onClick={() => setUseRawLlmParsing(!useRawLlmParsing)}
                                            className={\`relative inline-flex h-5 w-9 items-center rounded-full transition-colors \${useRawLlmParsing ? 'bg-cyan-600' : 'bg-slate-700'}\`}
                                        >
                                            <span className={\`inline-block h-3 w-3 transform rounded-full bg-white transition-transform \${useRawLlmParsing ? 'translate-x-5' : 'translate-x-1'}\`} />
                                        </button>
                                    </div>
                                </div>
                            )}`;

if (!re.test(s)) {
  console.error('토글 영역을 찾지 못했습니다.');
  process.exit(1);
}

s = s.replace(re, newBlock);

fs.writeFileSync(path, s, 'utf8');
console.log('3개 토글 UI 패치 완료');
