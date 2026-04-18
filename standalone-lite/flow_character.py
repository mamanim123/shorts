import os
import sys
import json
import time
import base64
from pathlib import Path

# ────────────────────────────────────────────
# 경로 설정
# ────────────────────────────────────────────
BASE_DIR       = Path(r"F:\test\쇼츠대본생성기-v3.5.3\standalone-lite")
CHARACTER_DIR  = BASE_DIR / "캐릭터"
USER_DATA_DIR  = BASE_DIR / "server" / "user_data" / "puppeteer"
LIBRARY_PATH   = CHARACTER_DIR / "character-library.json"
CHROME_PATH    = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
FLOW_URL       = "https://flow.google.com"

# ────────────────────────────────────────────
# 의존성 자동 설치
# ────────────────────────────────────────────
def install_if_missing():
    import importlib, subprocess
    pkgs = {"selenium": "selenium", "webdriver_manager": "webdriver-manager"}
    for module, pip_name in pkgs.items():
        try:
            importlib.import_module(module)
        except ImportError:
            print(f"[설치중] {pip_name} ...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", pip_name, "-q"])

install_if_missing()

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from webdriver_manager.chrome import ChromeDriverManager

# ────────────────────────────────────────────
# 유틸
# ────────────────────────────────────────────
def log(msg):
    print(f"[AutoFlow] {msg}")

def wait(sec):
    time.sleep(sec)

def read_json(path):
    raw = path.read_bytes()
    if raw.startswith(b'\xef\xbb\xbf'):
        raw = raw[3:]
    return json.loads(raw.decode('utf-8'))

def image_to_base64(img_path):
    ext = img_path.suffix.lower().replace('.', '')
    if ext == 'jpg':
        ext = 'jpeg'
    b64 = base64.b64encode(img_path.read_bytes()).decode('utf-8')
    return f"data:image/{ext};base64,{b64}"

# ────────────────────────────────────────────
# 활성 캐릭터 + 시트 경로 조회
# ────────────────────────────────────────────
def get_active_characters():
    if not LIBRARY_PATH.exists():
        raise FileNotFoundError(f"character-library.json 없음: {LIBRARY_PATH}")

    library = read_json(LIBRARY_PATH)
    active_chars = []
    sheet_files = list(CHARACTER_DIR.glob("*_sheet.png"))
    log(f"폴더 내 시트 파일: {[f.name for f in sheet_files]}")

    for char in library.get("characters", []):
        if not char.get("isActive", False):
            continue

        sheet_path = None
        ref_name   = char.get("referenceImageFileName", "")

        # 1순위: referenceImageFileName 직접 사용
        if ref_name:
            candidate = CHARACTER_DIR / ref_name
            if candidate.exists():
                sheet_path = candidate
                log(f"[직접매칭] {ref_name}")

        # 2순위: 인코딩 깨짐 → 폴더에 파일 1개면 그것 사용
        if not sheet_path:
            if len(sheet_files) == 1:
                sheet_path = sheet_files[0]
                log(f"[폴백-단일] {sheet_path.name}")
            elif len(sheet_files) > 1:
                # 이름 인덱스로 순서 매칭 (slot 번호 기준)
                slot_idx = 0
                for i, c in enumerate(library.get("characters", [])):
                    if c.get("id") == char.get("id"):
                        slot_idx = i
                        break
                if slot_idx < len(sheet_files):
                    sheet_path = sheet_files[slot_idx]
                    log(f"[폴백-인덱스] {sheet_path.name}")

        if sheet_path and sheet_path.exists():
            active_chars.append({
                "id"       : char["id"],
                "name"     : char.get("name", ""),
                "prompt"   : char.get("aiOptimizedPrompt", ""),
                "negative" : char.get("negativePrompt", ""),
                "sheet"    : sheet_path,
            })
        else:
            log(f"[경고] 시트 PNG 없음 → 건너뜀: id={char.get('id')}")

    if not active_chars:
        raise ValueError("활성 캐릭터가 없거나 시트 PNG를 찾지 못했습니다.")

    return active_chars

# ────────────────────────────────────────────
# Selenium Chrome 드라이버 초기화
# ────────────────────────────────────────────
def init_driver():
    options = Options()
    options.add_argument(f"--user-data-dir={USER_DATA_DIR}")
    options.add_argument("--profile-directory=Default")
    options.add_argument("--window-size=1280,900")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    options.binary_location = CHROME_PATH

    try:
        service = Service(ChromeDriverManager().install())
    except Exception:
        service = Service()

    driver = webdriver.Chrome(service=service, options=options)
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    })
    return driver

# ────────────────────────────────────────────
# Google Flow 열기
# ────────────────────────────────────────────
def open_flow(driver):
    log("Google Flow 열기...")
    driver.get(FLOW_URL)
    wait(3)
    log(f"현재 URL: {driver.current_url}")

# ────────────────────────────────────────────
# 새 프로젝트 클릭
# ────────────────────────────────────────────
def click_new_project(driver):
    wdw = WebDriverWait(driver, 20)
    selectors = [
        "//button[contains(text(),'새 프로젝트')]",
        "//button[contains(text(),'New project')]",
        "//button[contains(text(),'Create')]",
        "//div[contains(@class,'new-project')]",
        "//button[@aria-label='New project']",
    ]
    for sel in selectors:
        try:
            btn = wdw.until(EC.element_to_be_clickable((By.XPATH, sel)))
            btn.click()
            log(f"새 프로젝트 클릭 성공: {sel}")
            wait(2)
            return True
        except Exception:
            continue
    log("[경고] 새 프로젝트 버튼 못 찾음 → 현재 페이지 그대로 진행")
    return False

# ────────────────────────────────────────────
# 캐릭터 시트 이미지 업로드 (핵심 함수)
# ────────────────────────────────────────────
def upload_character_sheet(driver, sheet_path):
    log(f"캐릭터 시트 업로드 시도: {sheet_path.name}")
    wdw = WebDriverWait(driver, 15)

    # ── 방법 1: input[type=file] 직접 send_keys ──
    try:
        file_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
        if file_inputs:
            # hidden input도 강제 활성화
            driver.execute_script("arguments[0].style.display='block'; arguments[0].style.visibility='visible';", file_inputs[0])
            file_inputs[0].send_keys(str(sheet_path))
            log("[방법1] input[type=file] send_keys 성공")
            wait(2)
            return True
    except Exception as e:
        log(f"[방법1 실패] {e}")

    # ── 방법 2: 업로드 버튼 클릭 후 파일 input 대기 ──
    upload_btns = [
        "button[aria-label*='upload' i]",
        "button[aria-label*='이미지']",
        "button[aria-label*='image' i]",
        "div[aria-label*='upload' i]",
        "[data-testid*='upload']",
        "button.upload-btn",
        "label[for*='file']",
    ]
    for sel in upload_btns:
        try:
            btn = wdw.until(EC.element_to_be_clickable((By.CSS_SELECTOR, sel)))
            btn.click()
            wait(1)
            fi = driver.find_element(By.CSS_SELECTOR, "input[type='file']")
            driver.execute_script("arguments[0].style.display='block';", fi)
            fi.send_keys(str(sheet_path))
            log(f"[방법2] 업로드버튼+file input 성공: {sel}")
            wait(2)
            return True
        except Exception:
            continue

    # ── 방법 3: + 버튼 (플러스 아이콘) 클릭 ──
    plus_selectors = [
        "//button[contains(@aria-label,'+')]",
        "//button[contains(@aria-label,'Add')]",
        "//button[contains(@aria-label,'추가')]",
        "//span[text()='+']/..",
        "//*[contains(@class,'add-image')]",
        "//*[contains(@class,'plus')]//button",
    ]
    for sel in plus_selectors:
        try:
            btn = wdw.until(EC.element_to_be_clickable((By.XPATH, sel)))
            btn.click()
            wait(1)
            fi = driver.find_element(By.CSS_SELECTOR, "input[type='file']")
            driver.execute_script("arguments[0].style.display='block';", fi)
            fi.send_keys(str(sheet_path))
            log(f"[방법3] +버튼+file input 성공: {sel}")
            wait(2)
            return True
        except Exception:
            continue

    # ── 방법 4: base64 drag-drop 시뮬레이션 ──
    try:
        log("[방법4] base64 드롭 시도...")
        b64_uri = image_to_base64(sheet_path)
        drop_target_selectors = [
            ".image-drop-zone",
            "[data-testid='image-input']",
            "canvas",
            ".flow-canvas",
            "main",
        ]
        for sel in drop_target_selectors:
            try:
                target = driver.find_element(By.CSS_SELECTOR, sel)
                driver.execute_script("""
                    const dataTransfer = new DataTransfer();
                    const response = fetch(arguments[1])
                        .then(r => r.blob())
                        .then(blob => {
                            const file = new File([blob], arguments[2], {type: 'image/png'});
                            dataTransfer.items.add(file);
                            const dropEvent = new DragEvent('drop', {
                                bubbles: true,
                                cancelable: true,
                                dataTransfer: dataTransfer
                            });
                            arguments[0].dispatchEvent(dropEvent);
                        });
                """, target, b64_uri, sheet_path.name)
                wait(2)
                log(f"[방법4] 드롭 시뮬레이션 완료: {sel}")
                return True
            except Exception:
                continue
    except Exception as e:
        log(f"[방법4 실패] {e}")

    log("[경고] 모든 업로드 방법 실패 → 수동 업로드 필요")
    return False

# ────────────────────────────────────────────
# 프롬프트 입력
# ────────────────────────────────────────────
def input_prompt(driver, prompt_text):
    log(f"프롬프트 입력: {prompt_text[:50]}...")
    wdw = WebDriverWait(driver, 15)

    selectors = [
        "textarea[placeholder*='Describe']",
        "textarea[placeholder*='prompt']",
        "textarea[placeholder*='Enter']",
        "div[contenteditable='true']",
        "textarea",
    ]
    for sel in selectors:
        try:
            el = wdw.until(EC.element_to_be_clickable((By.CSS_SELECTOR, sel)))
            el.click()
            wait(0.3)
            el.send_keys(Keys.CONTROL + "a")
            el.send_keys(Keys.DELETE)
            wait(0.2)
            el.send_keys(prompt_text)
            log(f"프롬프트 입력 성공: {sel}")
            wait(0.5)
            return True
        except Exception:
            continue

    log("[경고] 프롬프트 입력창 못 찾음")
    return False

# ────────────────────────────────────────────
# 생성 버튼 클릭
# ────────────────────────────────────────────
def click_generate(driver):
    log("생성 버튼 클릭...")
    wdw = WebDriverWait(driver, 10)

    selectors = [
        "button[aria-label*='Generate' i]",
        "button[aria-label*='생성']",
        "button[type='submit']",
        "//button[contains(text(),'Generate')]",
        "//button[contains(text(),'생성')]",
        "//button[contains(text(),'Create')]",
    ]
    for sel in selectors:
        try:
            by = By.XPATH if sel.startswith("//") else By.CSS_SELECTOR
            btn = wdw.until(EC.element_to_be_clickable((by, sel)))
            btn.click()
            log(f"생성 버튼 클릭 성공: {sel}")
            wait(1)
            return True
        except Exception:
            continue

    # Enter 키로 대체
    try:
        ActionChains(driver).send_keys(Keys.ENTER).perform()
        log("생성: Enter 키로 대체")
        return True
    except Exception as e:
        log(f"[경고] 생성 버튼 실패: {e}")
        return False

# ────────────────────────────────────────────
# 생성 완료 대기
# ────────────────────────────────────────────
def wait_for_generation(driver, timeout=120):
    log("이미지 생성 대기 중...")
    wdw = WebDriverWait(driver, timeout)

    result_selectors = [
        "img[src*='generated']",
        "img[src*='blob:']",
        "img[src*='lh3.googleusercontent']",
        ".generated-image img",
        "[data-testid*='result'] img",
        ".image-result img",
        "figure img",
    ]
    for sel in result_selectors:
        try:
            wdw.until(EC.presence_of_element_located((By.CSS_SELECTOR, sel)))
            log(f"생성 완료 감지: {sel}")
            wait(1)
            return True
        except Exception:
            continue

    log("[경고] 생성 완료 감지 실패 → 30초 대기")
    wait(30)
    return False

# ────────────────────────────────────────────
# DOM 구조 스캔 (디버깅용)
# ────────────────────────────────────────────
def scan_dom(driver):
    log("=== DOM 구조 스캔 ===")
    result = driver.execute_script("""
        const info = {
            url: window.location.href,
            title: document.title,
            buttons: [],
            inputs: [],
            textareas: [],
            file_inputs: []
        };

        document.querySelectorAll('button').forEach(b => {
            const label = b.getAttribute('aria-label') || b.textContent.trim().slice(0, 30);
            if (label) info.buttons.push(label);
        });

        document.querySelectorAll('input').forEach(i => {
            info.inputs.push({
                type: i.type,
                placeholder: i.placeholder,
                name: i.name,
                id: i.id
            });
        });

        document.querySelectorAll('textarea').forEach(t => {
            info.textareas.push({
                placeholder: t.placeholder,
                id: t.id
            });
        });

        document.querySelectorAll("input[type='file']").forEach(f => {
            info.file_inputs.push({
                accept: f.accept,
                id: f.id,
                name: f.name
            });
        });

        return info;
    """)

    print(f"\n  URL    : {result['url']}")
    print(f"  Title  : {result['title']}")
    print(f"  버튼들  : {result['buttons'][:10]}")
    print(f"  입력창  : {result['inputs']}")
    print(f"  텍스트  : {result['textareas']}")
    print(f"  파일입력: {result['file_inputs']}")
    print("=" * 40)
    return result

# ────────────────────────────────────────────
# 메인 실행
# ────────────────────────────────────────────
def main():
    print("=" * 50)
    print("  Google Flow 캐릭터 시트 자동화 도구")
    print("=" * 50)

    # 1. 활성 캐릭터 로드
    try:
        characters = get_active_characters()
        log(f"활성 캐릭터 {len(characters)}개 로드 완료")
        for c in characters:
            log(f"  - {c['name']} | 시트: {c['sheet'].name}")
    except Exception as e:
        print(f"[오류] 캐릭터 로드 실패: {e}")
        sys.exit(1)

    # 2. 프롬프트 입력 받기
    print("\n" + "=" * 50)
    print("  프롬프트를 입력하세요 (빈 줄 입력 시 종료)")
    print("  여러 줄 입력 가능 → 한 줄 = 1개 씬")
    print("=" * 50)
    prompts = []
    while True:
        line = input("> ").strip()
        if not line:
            break
        prompts.append(line)

    if not prompts:
        log("프롬프트 없음 → 테스트 모드로 DOM 스캔만 실행")

    # 3. 드라이버 초기화
    log("Chrome 실행 중...")
    driver = init_driver()

    try:
        # 4. Google Flow 열기
        open_flow(driver)

        # 5. DOM 구조 스캔 (첫 실행 시 확인용)
        scan_dom(driver)

        # 6. 새 프로젝트
        click_new_project(driver)

        # 7. 캐릭터 시트 업로드
        char = characters[0]
        upload_ok = upload_character_sheet(driver, char["sheet"])
        if not upload_ok:
            log("[주의] 업로드 실패 → scan_dom으로 실제 버튼 구조 확인 필요")
            scan_dom(driver)

        # 8. 프롬프트별 순차 생성
        if prompts:
            for i, prompt in enumerate(prompts, 1):
                log(f"\n▶ 씬 {i:02d}/{len(prompts):02d} 처리 중...")

                full_prompt = f"{char['prompt']}, {prompt}" if char['prompt'] else prompt

                input_ok = input_prompt(driver, full_prompt)
                if input_ok:
                    click_generate(driver)
                    wait_for_generation(driver)
                    log(f"씬 {i:02d} 완료")
                else:
                    log(f"씬 {i:02d} 입력 실패 → 건너뜀")

        log("\n모든 작업 완료! 브라우저를 확인하세요.")
        input("\nEnter 키를 누르면 종료됩니다...")

    except KeyboardInterrupt:
        log("사용자 중단")
    except Exception as e:
        print(f"[오류] {e}")
        import traceback
        traceback.print_exc()
        scan_dom(driver)
        input("\nEnter 키를 누르면 종료됩니다...")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()