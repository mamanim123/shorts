import puppeteer from "puppeteer";
(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto("https://tubefactory.kr/", { waitUntil: "networkidle2" });
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
            .filter(rule => rule.type === 7 || rule.cssText.includes("hover"))
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
