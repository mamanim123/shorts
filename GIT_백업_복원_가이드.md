# 🛡️ Git 백업 및 복원 가이드

프로젝트 백업 및 복원 방법을 단계별로 안내합니다.

---

## 📋 현재 브랜치 상태

```
✅ master (원본 메인 브랜치)
✅ backup-before-metadata-improvement (백업 브랜치 - 2026-01-03)
✅ feature/metadata-improvement (작업 브랜치 - 현재 작업중)
```

### 커밋 히스토리
```
d75ff84 ✨ AI Studio 이미지 메타데이터 및 UI 프롬프트 표시 개선 (최신)
99e6d6d 💾 PNG 메타데이터 & UI 프롬프트 표시 개선 작업 전 백업 (백업 지점)
4a4e660 🔧 이미지 메타데이터 저장 및 AI Studio 표시 기능 추가
```

---

## 🚀 새로운 작업 시작하기 (백업 생성)

### ✅ 체크리스트

- [ ] 1단계: 현재 작업 상태 확인
- [ ] 2단계: 커밋 메시지 작성
- [ ] 3단계: 변경사항 커밋
- [ ] 4단계: 백업 브랜치 생성
- [ ] 5단계: 작업 브랜치 생성
- [ ] 6단계: 브랜치 확인

---

### 1단계: 현재 작업 상태 확인

```bash
# 현재 브랜치 및 상태 확인
git status

# 현재 브랜치 확인
git branch
```

**확인사항**:
- 수정된 파일 목록
- 커밋되지 않은 변경사항
- 현재 어떤 브랜치에 있는지

---

### 2단계: 커밋 메시지 작성

`.commit_message.txt` 파일 생성 또는 수정:

```
💾 [작업명] 개선 작업 전 백업

현재 상태:
- [현재 기능 상태 설명]
- [주요 변경사항]

개선 예정:
1. [개선 계획 1]
2. [개선 계획 2]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**예시**:
```
💾 AI Studio 프롬프트 편집 기능 추가 작업 전 백업

현재 상태:
- AI Studio 이미지 생성 및 메타데이터 저장 기능 작동 중
- UI에서 프롬프트 표시 가능

개선 예정:
1. AI Studio에서 프롬프트 직접 편집 기능 추가
2. 편집 히스토리 저장 기능 구현

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

### 3단계: 변경사항 커밋

```bash
# 모든 변경사항 스테이징
git add .

# 커밋 메시지 파일로 커밋
git commit -F .commit_message.txt
```

**확인**:
```bash
# 최근 커밋 확인
git log --oneline -1
```

---

### 4단계: 백업 브랜치 생성

```bash
# 백업 브랜치 생성 (날짜 포함 권장)
git branch backup-before-[작업명]-2026-01-03
```

**예시**:
```bash
git branch backup-before-prompt-edit-2026-01-03
```

---

### 5단계: 작업 브랜치 생성 및 전환

```bash
# 작업용 브랜치 생성 및 전환
git checkout -b feature/[작업명]
```

**예시**:
```bash
git checkout -b feature/prompt-edit
```

---

### 6단계: 브랜치 확인

```bash
# 모든 브랜치 목록 확인
git branch -a

# 현재 브랜치 확인 (* 표시가 현재 브랜치)
git branch
```

**예상 출력**:
```
  backup-before-prompt-edit-2026-01-03
* feature/prompt-edit
  master
```

---

## 🔄 복원하기 (이전 상태로 되돌리기)

### ⚠️ 주의사항
- 복원하면 **현재 작업 중인 변경사항이 사라질 수 있습니다**
- 복원 전에 현재 작업을 커밋하거나 stash 하세요

---

### 방법 1: 백업 브랜치로 복원 (권장)

```bash
# 현재 작업 임시 저장 (선택사항)
git stash save "임시 저장: 복원 전 작업"

# 백업 브랜치로 전환
git checkout backup-before-[작업명]-2026-01-03
```

**예시**:
```bash
git checkout backup-before-metadata-improvement
```

**확인**:
```bash
# 현재 커밋 확인
git log --oneline -3
```

---

### 방법 2: master 브랜치로 복원

```bash
# master 브랜치로 전환
git checkout master
```

---

### 방법 3: 특정 커밋으로 복원

```bash
# 커밋 히스토리 확인
git log --oneline -10

# 특정 커밋으로 이동
git checkout [커밋해시]
```

**예시**:
```bash
git checkout 99e6d6d
```

---

### 복원 후 다시 작업 브랜치로 돌아가기

```bash
# 작업 브랜치로 전환
git checkout feature/[작업명]

# 임시 저장했던 작업 복구 (선택사항)
git stash pop
```

---

## 🔍 상태 확인 명령어 모음

### 브랜치 관련

```bash
# 모든 브랜치 목록
git branch -a

# 현재 브랜치 확인
git branch

# 브랜치별 최신 커밋 확인
git branch -v
```

### 커밋 히스토리

```bash
# 최근 5개 커밋 (한 줄)
git log --oneline -5

# 최근 10개 커밋 (상세)
git log -10

# 브랜치별 커밋 그래프
git log --graph --oneline --all
```

### 변경사항 확인

```bash
# 현재 상태
git status

# 수정된 내용 확인
git diff

# 스테이징된 변경사항 확인
git diff --staged
```

---

## 🗑️ 브랜치 삭제

### 작업 완료 후 브랜치 삭제

```bash
# 작업 브랜치 삭제 (master로 merge 후)
git branch -d feature/[작업명]

# 강제 삭제 (merge 안 해도 삭제)
git branch -D feature/[작업명]
```

**예시**:
```bash
# 작업 완료 후
git checkout master
git branch -d feature/metadata-improvement
```

---

## 📚 자주 사용하는 시나리오

### 시나리오 1: 작업이 잘못되어 백업으로 돌아가기

```bash
# 1. 백업 브랜치로 전환
git checkout backup-before-metadata-improvement

# 2. 새로운 작업 브랜치 생성
git checkout -b feature/metadata-improvement-v2

# 3. 다시 작업 시작
```

---

### 시나리오 2: 작업 중간 저장 후 다른 작업하기

```bash
# 1. 현재 작업 임시 저장
git stash save "작업 중: 프롬프트 편집 기능"

# 2. 다른 브랜치로 전환
git checkout master

# 3. 긴급 수정 작업...

# 4. 다시 작업 브랜치로 돌아오기
git checkout feature/prompt-edit

# 5. 임시 저장한 작업 복구
git stash pop
```

---

### 시나리오 3: 작업 완료 후 master에 병합

```bash
# 1. master 브랜치로 전환
git checkout master

# 2. 작업 브랜치 병합
git merge feature/metadata-improvement

# 3. 병합 확인
git log --oneline -3

# 4. 작업 브랜치 삭제 (선택)
git branch -d feature/metadata-improvement
```

---

## ⚠️ 주의사항

### 🚫 하지 말아야 할 것

1. **백업 브랜치 직접 수정 금지**
   - 백업 브랜치는 읽기 전용으로 유지
   - 수정이 필요하면 새 브랜치 생성

2. **강제 push 금지**
   ```bash
   # 절대 하지 마세요!
   git push --force
   ```

3. **master 브랜치에서 직접 작업 금지**
   - 항상 작업 브랜치 생성 후 작업

---

### ✅ 권장사항

1. **작업 전 항상 백업 브랜치 생성**
2. **의미 있는 커밋 메시지 작성**
3. **작은 단위로 자주 커밋**
4. **브랜치 이름에 날짜 포함** (예: backup-2026-01-03)
5. **주기적으로 git status 확인**

---

## 🆘 문제 해결

### 문제 1: 브랜치 전환이 안 됨

**증상**:
```
error: Your local changes would be overwritten by checkout
```

**해결**:
```bash
# 옵션 1: 변경사항 커밋
git add .
git commit -m "작업 중간 저장"

# 옵션 2: 임시 저장
git stash save "임시 저장"

# 그 후 브랜치 전환
git checkout [브랜치명]
```

---

### 문제 2: 실수로 커밋했을 때

**최근 커밋 취소** (파일은 유지):
```bash
git reset --soft HEAD~1
```

**최근 커밋 완전 삭제** (파일도 삭제):
```bash
git reset --hard HEAD~1
```

---

### 문제 3: 브랜치를 잘못 만들었을 때

```bash
# 브랜치 이름 변경
git branch -m [현재이름] [새이름]

# 브랜치 삭제
git branch -D [브랜치명]
```

---

## 📞 도움말

### Git 명령어 도움말

```bash
# 명령어 도움말
git help [명령어]

# 예시
git help branch
git help checkout
git help merge
```

---

## 🎯 빠른 참조 카드

```bash
# 백업 생성
git add . && git commit -m "백업" && git branch backup-$(date +%Y%m%d)

# 백업으로 복원
git checkout backup-[날짜]

# 작업 브랜치 생성
git checkout -b feature/[작업명]

# 현재 상태 확인
git status && git branch

# 커밋 히스토리
git log --oneline -5

# 임시 저장
git stash save "설명"

# 임시 저장 복구
git stash pop
```

---

**마지막 업데이트**: 2026-01-03
**작성자**: Claude Code Assistant
**버전**: 1.0
