
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

console.log("Puppeteer object:", puppeteer);
console.log("Puppeteer.launch type:", typeof puppeteer.launch);
console.log("Puppeteer.default:", puppeteer.default);

if (puppeteer.default) {
    console.log("Using puppeteer.default...");
    puppeteer.default.use(StealthPlugin());
    puppeteer.default.launch({ headless: true }).then(() => console.log("Launch success with default")).catch(e => console.error("Launch failed with default", e));
} else {
    console.log("Using puppeteer directly...");
    puppeteer.use(StealthPlugin());
    puppeteer.launch({ headless: true }).then(() => console.log("Launch success directly")).catch(e => console.error("Launch failed directly", e));
}
