import os
import re

BASE = os.path.dirname(os.path.abspath(__file__))
FILE_PATH = os.path.join(BASE, "features", "shorts-lab", "components", "TubeFactoryPanel.tsx")
FILE_PATH2 = os.path.join(BASE, "server", "index.js")

# 읽기
with open(FILE_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# 삭제 버튼 패치
OLD_BTN = r'''onClick=\{\(e\)\s*=>\s*\{\s*e\.stopPropagation\(\);\s*\}\}>삭제</button>'''
NEW_BTN = 'onClick={(e) => { e.stopPropagation(); handleDeleteProject(proj.folderName); }}>삭제</button>'

patched, count = re.subn(OLD_BTN, NEW_BTN, content)
if count > 0:
    print("패치 1 완료")
else:
    print("패치 1 실패")

# 임시 파일에 먼저 쓰기
tmp_path = os.path.join(BASE, "TubeFactoryPanel_tmp.tsx")
with open(tmp_path, 'w', encoding='utf-8') as f:
    f.write(patched)
print("임시파일 저장:", tmp_path)

# 원본 삭제 후 이름 변경
os.remove(FILE_PATH)
os.rename(tmp_path, FILE_PATH)
print("원본 교체 완료")

# 서버 API
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
        print("서버 API 추가 완료")

    tmp2 = os.path.join(BASE, "index_tmp.js")
    with open(tmp2, 'w', encoding='utf-8') as f:
        f.write(content2)
    os.remove(FILE_PATH2)
    os.rename(tmp2, FILE_PATH2)
    print("server/index.js 저장 완료")
else:
    print("서버 API 이미 존재")

print("모든 패치 완료!")
