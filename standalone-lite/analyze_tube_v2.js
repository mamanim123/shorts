import puppeteer from "puppeteer";
(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto("https://tubefactory.kr/", { waitUntil: "networkidle2" });
  
  // Wait for content to load
  await new Promise(r => setTimeout(r, 2000));

  const data = await page.evaluate(() => {
    // 1. Hover effects on images/cards
    const elements = Array.from(document.querySelectorAll("div, section, img, a"))
      .filter(el => {
        const style = window.getComputedStyle(el);
        return style.transition !== "all 0s ease 0s" || style.transform !== "none";
      })
      .slice(0, 20)
      .map(el => ({
        tagName: el.tagName,
        className: el.className,
        transition: window.getComputedStyle(el).transition,
        transform: window.getComputedStyle(el).transform,
        filter: window.getComputedStyle(el).filter
      }));

    // 2. Specific styles for .card-glow or similar
    const cardGlow = Array.from(document.querySelectorAll(".card-glow, [class*=\"card\"]")).map(el => ({
      className: el.className,
      style: el.getAttribute("style"),
      computed: {
        transition: window.getComputedStyle(el).transition,
        transform: window.getComputedStyle(el).transform,
        boxShadow: window.getComputedStyle(el).boxShadow
      }
    })).slice(0, 5);

    return { elements, cardGlow };
  });
  
  console.log("DATA_START");
  console.log(JSON.stringify(data));
  console.log("DATA_END");
  await browser.close();
})();
