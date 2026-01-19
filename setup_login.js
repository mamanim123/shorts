import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const chromePath = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';

(async () => {
    const profiles = [
        { name: '대본 생성용 (Script)', path: path.join(process.cwd(), 'user_data_script') },
        { name: '이미지 생성용 (Image)', path: path.join(process.cwd(), 'user_data_image') }
    ];

    console.log('=========================================================');
    console.log('🚀 [최종 해결책] 순수 크롬 직접 실행 로그인 모드');
    console.log('=========================================================');
    console.log('💡 이 방식은 퍼피티어를 사용하지 않으므로 구글 보안에 걸리지 않습니다.');
    console.log('💡 브라우저가 열리면 로그인을 진행하고, 완료 후 창을 닫아주세요.\n');

    for (const profile of profiles) {
        // 폴더가 없으면 미리 생성
        if (!fs.existsSync(profile.path)) {
            fs.mkdirSync(profile.path, { recursive: true });
        }

        console.log(`---------------------------------------------------------`);
        console.log(`[작업 중] ${profile.name} 세션 설정...`);
        console.log(`---------------------------------------------------------`);

        // 진짜 크롬을 직접 실행하는 명령어
        // --user-data-dir: 로그인 정보가 저장될 경로
        // --no-first-run: 첫 실행 안내 생략
        const services = [
            'https://gemini.google.com/app',
            'https://chatgpt.com',
            'https://claude.ai/login',
            'https://genspark.ai'
        ].join(' ');

        const command = `${chromePath} --user-data-dir="${profile.path}" --no-first-run ${services}`;

        try {
            console.log(`\n👉 진짜 크롬 창이 열리면 각 사이트에 로그인해 주세요.`);
            console.log(`👉 로그인을 모두 마쳤다면 [브라우저 창을 완전히 닫아주세요].`);
            console.log(`👉 그래야 다음 단계로 넘어갑니다.\n`);
            
            execSync(command); // 브라우저가 닫힐 때까지 대기
            
            console.log(`✅ [${profile.name}] 설정이 완료되었습니다.`);
        } catch (e) {
            console.error(`❌ 실행 중 오류 발생:`, e.message);
            console.log('\n💡 만약 크롬이 이미 열려있다면 모두 닫고 다시 실행해 주세요.');
        }
    }

    console.log('\n=========================================================');
    console.log('🎉 모든 로그인이 완료되었습니다! 이제 프로그램을 실행하세요.');
    console.log('=========================================================');
    process.exit(0);
})();
