# patch_storyline.ps1
$BASE = "F:\test\쇼츠대본생성기-v3.5.3"
$GEMINI_SERVICE = "$BASE\services\geminiService.ts"
$SHORTS_LAB_PANEL = "$BASE\components\ShortsLabPanel.tsx"
$TS = (Get-Date -Format "yyyyMMdd_HHmmss")

Write-Host "[1/4] 백업 중..." -ForegroundColor Cyan
Copy-Item $GEMINI_SERVICE ($GEMINI_SERVICE + ".bak_" + $TS)
Copy-Item $SHORTS_LAB_PANEL ($SHORTS_LAB_PANEL + ".bak_" + $TS)
Write-Host "  백업 완료" -ForegroundColor Green

Write-Host "[2/4] geminiService.ts 패치 중..." -ForegroundColor Cyan
$g = Get-Content $GEMINI_SERVICE -Encoding UTF8 -Raw
if ($g -match "generateBenchmarkStorylinePackage") {
    Write-Host "  이미 패치됨 스킵" -ForegroundColor Yellow
} else {
    $add = Get-Content "$BASE\patch_gemini_append.ts" -Encoding UTF8 -Raw
    ($g + $add) | Set-Content $GEMINI_SERVICE -Encoding UTF8
    Write-Host "  완료" -ForegroundColor Green
}

Write-Host "[3/4] ShortsLabPanel.tsx 패치 중..." -ForegroundColor Cyan
$p = Get-Content $SHORTS_LAB_PANEL -Encoding UTF8 -Raw

if ($p -notmatch "generateBenchmarkStorylinePackage") {
    $p = $p -replace "import \{ enhancePromptWithSafeGlamour \} from '\.\./services/geminiService';", "import { enhancePromptWithSafeGlamour, generateBenchmarkStorylinePackage } from '../services/geminiService';`nimport type { BenchmarkAnalysisSummary, StorylineItem } from '../services/geminiService';"
    Write-Host "  Import 패치 완료" -ForegroundColor Green
}

if ($p -notmatch "scriptPhase") {
    $old = "    const [isGenerating, setIsGenerating] = useState(false);`r`n    const [isMasterGenerating, setIsMasterGenerating] = useState(false);"
    $new = "    const [isGenerating, setIsGenerating] = useState(false);`r`n    const [isMasterGenerating, setIsMasterGenerating] = useState(false);`r`n    const [scriptPhase, setScriptPhase] = useState<'idle' | 'storylines'>('idle');`r`n    const [storylines, setStorylines] = useState<StorylineItem[]>([]);`r`n    const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);`r`n    const [selectedStoryDraft, setSelectedStoryDraft] = useState('');`r`n    const [benchmarkAnalysis, setBenchmarkAnalysis] = useState<BenchmarkAnalysisSummary | null>(null);`r`n    const [benchmarkSource, setBenchmarkSource] = useState('');"
    $p = $p -replace [regex]::Escape($old), $new
    Write-Host "  State 패치 완료" -ForegroundColor Green
}

if ($p -notmatch "handleGenerateStorylines") {
    $logicAdd = Get-Content "$BASE\patch_panel_logic.ts" -Encoding UTF8 -Raw
    $p = $p -replace [regex]::Escape("    const handleAiGenerate = async () => {"), ($logicAdd + "`r`n    const handleAiGenerate = async () => { await handleAiGenerateWithContext(); };`r`n`r`n    const handleAiGenerateWithContext = async (storyContext?: string) => {")
    Write-Host "  로직 패치 완료" -ForegroundColor Green
}

if ($p -notmatch "handleGenerateStorylines.*disabled|disabled.*handleGenerateStorylines") {
    $uiAdd = Get-Content "$BASE\patch_panel_ui.tsx" -Encoding UTF8 -Raw
    $p = $p -replace [regex]::Escape("                                    <div className=`"grid grid-cols-1 md:grid-cols-2 gap-3`">"), $uiAdd
    Write-Host "  UI 패치 완료" -ForegroundColor Green
}

$p | Set-Content $SHORTS_LAB_PANEL -Encoding UTF8
Write-Host "[4/4] 저장 완료" -ForegroundColor Green
Write-Host "패치 완료!" -ForegroundColor Cyan
