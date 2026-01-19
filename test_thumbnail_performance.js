// 🧪 사이드바 썸네일 성능 테스트 스크립트
// 브라우저 콘솔에서 실행하여 최적화 효과를 확인하세요

console.log('🧪 사이드바 썸네일 성능 테스트 시작\n');

// 테스트 카운터
let loadCount = 0;
const originalConsoleLog = console.log;

// [Performance] 로그 카운팅
console.log = function (...args) {
    const message = args.join(' ');
    if (message.includes('[Performance] Loading') && message.includes('thumbnails')) {
        loadCount++;
        originalConsoleLog.call(console, `📊 로딩 횟수: ${loadCount}회`, ...args);
    } else {
        originalConsoleLog.apply(console, args);
    }
};

setTimeout(() => {
    console.log = originalConsoleLog; // 원래대로 복원
    console.log('\n✅ 테스트 완료!');
    console.log(`총 썸네일 로딩 횟수: ${loadCount}회`);

    if (loadCount === 0) {
        console.log('🎉 완벽! 이미 로드된 이미지는 재로드하지 않았습니다.');
    } else if (loadCount === 1) {
        console.log('✅ 양호! 초기 로딩만 1회 발생했습니다.');
    } else if (loadCount === 2) {
        console.log('⚠️ 주의! 2번 로딩되었습니다. 새 이미지 추가가 있었나요?');
    } else {
        console.log('❌ 문제! 과도한 로딩이 발생했습니다. 콘솔 로그를 확인하세요.');
    }
}, 30000); // 30초 동안 모니터링

console.log('📌 이제 다음 작업을 수행하세요:');
console.log('1. "보관함" 탭 클릭');
console.log('2. "쇼츠 생성기" 탭 클릭');
console.log('3. 다시 "보관함" 탭 클릭');
console.log('4. "생성대본" 클릭');
console.log('5. "영상대본" 클릭');
console.log('6. "테스트대본" 클릭');
console.log('\n⏱️ 30초 후 자동으로 결과를 보고합니다...\n');
