import os

FILE_PATH = r"F:\test\쇼츠대본생성기-v3.5.3\standalone-lite\features\shorts-lab\components\TubeFactoryPanel.tsx"
FILE_PATH2 = r"F:\test\쇼츠대본생성기-v3.5.3\standalone-lite\server\index.js"

with open(FILE_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# 패치 1: 삭제 버튼 핸들러 연결 (정규식 사용)
import re

OLD_BTN = r'''onClick=\{\(e\)\s*=>\s*\{
\s*e\.stopPropagation\(\);
\s*\}\}>삭제</button>'''

NEW_BTN = '''onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(proj.folderName);
                             }}>삭제</button>'''

patched, count = re.subn(OLD_BTN, NEW_BTN, content)
if count > 0:
    print("✅ 패치 1 완료: 삭제 버튼 핸들러 연결")
else:
    print("⚠️ 패치 1 실패")

# 패치 2: handleDeleteProject 함수 (이미 추가됐으면 스킵)
if 'handleDeleteProject' not in patched:
    OLD_FETCH = '  const fetchProjects = useCallback(async () => {'
    NEW_FETCH = '''  const handleDeleteProject = async (folderName: string) => {
    if (!window.confirm(`'${folderName}' 프로젝트를 삭제할까요?`)) return;
    try {
      const res = await fetch(`http://localhost:3002/api/delete-story/${encodeURIComponent(folderName)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.folderName !== folderName));
        showToast(`'${folderName}' 삭제 완료`, 'success');
      } else {
        showToast('삭제 실패', 'error');
      }
    } catch (err) {
      showToast('삭제 중 오류 발생', 'error');
    }
  };

  const fetchProjects = useCallback(async () => {'''

    if OLD_FETCH in patched:
        patched = patched.replace(OLD_FETCH, NEW_FETCH)
        print("✅ 패치 2 완료: handleDeleteProject 함수 추가")
    else:
        print("⚠️ 패치 2 실패")
else:
    print("✅ handleDeleteProject 이미 존재 - 스킵")

with open(FILE_PATH, 'w', encoding='utf-8') as f:
    f.write(patched)
print(f"✅ TubeFactoryPanel.tsx 저장 완료")

# 서버 API 추가
with open(FILE_PATH2, 'r', encoding='utf-8') as f:
    content2 = f.read()

if '/api/delete-story/' not in content2:
    OLD_API = "app.get('/api/story/:storyId', (req, res) => {"
    NEW_API = """app.delete('/api/delete-story/:storyId', (req, res) => {
  try {
    const safeStoryId = sanitizeName(req.params.storyId || '');
    const storyDir = path.join(generatedStoryDir, safeStoryId);
    if (!fs.existsSync(storyDir)) {
      return res.status(404).json({ success: false, error: '폴더를 찾을 수 없습니다.' });
    }
    fs.rmSync(storyDir, { recursive: true, force: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : '삭제 실패' });
  }
});

app.get('/api/story/:storyId', (req, res) => {"""

    if OLD_API in content2:
        content2 = content2.replace(OLD_API, NEW_API)
        print("✅ 서버 삭제 API 추가 완료")
    else:
        print("⚠️ 서버 API 위치 못 찾음")

    with open(FILE_PATH2, 'w', encoding='utf-8') as f:
        f.write(content2)
else:
    print("✅ 서버 API 이미 존재 - 스킵")

print("✅ 모든 패치 완료!")

