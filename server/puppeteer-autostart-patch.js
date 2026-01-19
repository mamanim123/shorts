// [PERFORMANCE] Puppeteer Auto-Start Configuration
// Puppeteer 자동 시작으로 인한 서버 충돌 방지를 위해 환경 변수로 제어
// 환경 변수 PUPPETEER_AUTO_START=true 설정 시에만 자동 시작

if (process.env.PUPPETEER_AUTO_START === 'true') {
    console.log('[Server] Puppeteer auto-start enabled');
    launchBrowser().catch(err => {
        console.error('[Server] Puppeteer auto-start failed:', err.message);
        console.log('[Server] Continuing without Puppeteer. Use /api/launch to start manually.');
    });
} else {
    console.log('[Server] Puppeteer auto-start disabled. Use /api/launch endpoint to start browser.');
}
