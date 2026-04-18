const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("https://tubefactory.kr/", { waitUntil: "networkidle" });
  const data = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll("img")).map(img => ({
      src: img.src,
      alt: img.alt,
      style: img.getAttribute("style"),
      className: img.className
    }));
    const animations = Array.from(document.styleSheets)
      .flatMap(sheet => {
        try {
          return Array.from(sheet.cssRules)
            .filter(rule => rule.type === CSSRule.KEYFRAMES_RULE || rule.cssText.includes("hover"))
            .map(rule => rule.cssText);
        } catch (e) { return []; }
      });
    return { images, animations };
  });
  console.log("DATA_START");
  console.log(JSON.stringify(data));
  console.log("DATA_END");
  await browser.close();
})();
