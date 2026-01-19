import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export async function searchYouTube(keyword) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new", // Use new headless mode
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();

        // Block images/fonts/css for speed
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Go to YouTube Search
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}&sp=CAM%253D`; // Sort by View Count (CAM%3D)
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

        // Wait for video list
        await page.waitForSelector('ytd-video-renderer', { timeout: 10000 });

        // Scroll down a bit to load more
        await page.evaluate(async () => {
            window.scrollBy(0, window.innerHeight * 5);
            await new Promise(resolve => setTimeout(resolve, 1000));
        });

        // Extract Data
        const videos = await page.evaluate(() => {
            const items = document.querySelectorAll('ytd-video-renderer');
            const results = [];

            items.forEach(item => {
                try {
                    const titleEl = item.querySelector('#video-title');
                    const metaEls = item.querySelectorAll('#metadata-line span');
                    const channelEl = item.querySelector('#channel-info #text');
                    const thumbEl = item.querySelector('img');
                    const linkEl = item.querySelector('a#thumbnail');
                    const durationEl = item.querySelector('span.ytd-thumbnail-overlay-time-status-renderer');

                    if (!titleEl) return;

                    const title = titleEl.innerText.trim();
                    const url = 'https://www.youtube.com' + titleEl.getAttribute('href');
                    const id = titleEl.getAttribute('href').split('v=')[1];
                    const channelTitle = channelEl ? channelEl.innerText.trim() : 'Unknown';
                    const thumbnail = thumbEl ? thumbEl.src : '';

                    let viewCountText = '';
                    let publishedDate = '';

                    // Metadata parsing (Views & Date)
                    // Usually: [ "조회수 100만회", "1년 전" ]
                    if (metaEls.length >= 2) {
                        viewCountText = metaEls[0].innerText;
                        publishedDate = metaEls[1].innerText;
                    } else if (metaEls.length === 1) {
                        viewCountText = metaEls[0].innerText;
                    }

                    // Parse View Count to Number
                    let viewCount = 0;
                    const viewStr = viewCountText.replace(/[^0-9.]/g, ''); // Remove non-numeric except dot
                    if (viewCountText.includes('만회')) viewCount = parseFloat(viewStr) * 10000;
                    else if (viewCountText.includes('억회')) viewCount = parseFloat(viewStr) * 100000000;
                    else if (viewCountText.includes('천회')) viewCount = parseFloat(viewStr) * 1000;
                    else viewCount = parseFloat(viewStr) || 0;

                    // Duration
                    const durationStr = durationEl ? durationEl.innerText.trim() : '0:00';

                    results.push({
                        id,
                        title,
                        channelTitle,
                        viewCount,
                        viewCountText,
                        publishedDate,
                        thumbnail,
                        durationStr,
                        url,
                        viralScore: 0, // Will be calculated if sub count is known (hard to get in search page)
                        subCount: 1 // Default
                    });
                } catch (e) {
                    // Ignore error for single item
                }
            });
            return results;
        });

        return videos;

    } catch (error) {
        console.error("YouTube Search Error:", error);
        throw error;
    } finally {
        if (browser) await browser.close();
    }
}
