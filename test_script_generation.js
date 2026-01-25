/**
 * 대본 생성 테스트 스크립트
 * 서버가 실행 중인 상태에서 이 스크립트를 실행하세요:
 * node test_script_generation.js
 */

async function testScriptGeneration() {
    console.log('🧪 대본 생성 테스트 시작...\n');

    try {
        // 1. 브라우저 상태 확인
        console.log('1️⃣ 브라우저 상태 확인 중...');
        const browserStatus = await fetch('http://localhost:3002/api/browser-status');
        const status = await browserStatus.json();
        console.log('브라우저 상태:', JSON.stringify(status, null, 2));

        if (status.lastError) {
            console.error('❌ 브라우저 오류 발견:', status.lastError);
            console.log('💡 해결 방법: 서버를 재시작하거나 브라우저를 수동으로 실행하세요.');
            return;
        }

        console.log('✅ 브라우저 상태 정상\n');

        // 2. 간단한 대본 생성 테스트
        console.log('2️⃣ 대본 생성 API 테스트 중...');
        console.log('주제: "골프장에서 일어난 황당한 일"');
        console.log('장르: comedy-humor');
        console.log('타겟: 40대\n');

        const prompt = `
🚨🚨🚨 [MASTER REGULATIONS v3.9] 🚨🚨🚨
[1. CHARACTER SLOT SYSTEM]
- WomanA (지영): 한국 여성, 40대

[2. OUTFITS]
- WomanA: White Polo + Navy Golf Skirt

[3. NARRATOR]
- Narrator: Woman A (지영)

[4. INSTRUCTIONS]
- Create a viral shorts script about "골프장에서 일어난 황당한 일" in comedy-humor genre.
- 10-12문장으로 작성하세요.
- JSON 형식으로 반환하세요:
{
  "title": "제목",
  "scriptBody": "대본 내용...",
  "scenes": [
    {
      "sceneNumber": 1,
      "scriptLine": "장면 대사",
      "longPrompt": "이미지 프롬프트",
      "camera": "카메라 앵글"
    }
  ]
}
`;

        console.log('📤 요청 전송 중...');
        const startTime = Date.now();

        const response = await fetch('http://localhost:3002/api/generate/raw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                maxTokens: 2000,
                temperature: 0.9
            })
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (!response.ok) {
            console.error(`❌ API 오류: ${response.status}`);
            const errorData = await response.text();
            console.error('오류 내용:', errorData);
            return;
        }

        console.log(`✅ 응답 수신 (${elapsed}초 소요)\n`);

        const data = await response.json();
        console.log('3️⃣ 응답 분석:');
        console.log('- success:', data.success);
        console.log('- service:', data.service);
        console.log('- _folderName:', data._folderName);
        console.log('- rawResponse 길이:', data.rawResponse?.length || 0, '글자\n');

        // 3. JSON 파싱 테스트
        console.log('4️⃣ JSON 파싱 테스트...');
        try {
            let jsonText = data.rawResponse.trim();
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
            }
            const parsed = JSON.parse(jsonText);

            console.log('✅ JSON 파싱 성공');
            console.log('- title:', parsed.title || parsed.scripts?.[0]?.title);
            console.log('- scriptBody 길이:', (parsed.scriptBody || parsed.scripts?.[0]?.scriptBody || '').length, '글자');
            console.log('- scenes 개수:', (parsed.scenes || parsed.scripts?.[0]?.scenes || []).length, '개\n');

            if ((parsed.scenes || parsed.scripts?.[0]?.scenes || []).length > 0) {
                console.log('🎉 대본 생성 성공!');
                console.log('\n📋 첫 번째 장면 샘플:');
                const firstScene = (parsed.scenes || parsed.scripts?.[0]?.scenes)[0];
                console.log(JSON.stringify(firstScene, null, 2));
            } else {
                console.warn('⚠️ scenes 배열이 비어있습니다.');
            }

        } catch (parseError) {
            console.error('❌ JSON 파싱 실패:', parseError.message);
            console.log('\n원본 응답 (처음 500자):');
            console.log(data.rawResponse.substring(0, 500));
            console.log('\n💡 AI가 JSON 형식으로 응답하지 않았을 수 있습니다.');
        }

    } catch (error) {
        console.error('\n❌ 테스트 실패:', error.message);

        if (error.message.includes('ECONNREFUSED')) {
            console.log('\n💡 해결 방법:');
            console.log('1. 서버가 실행 중인지 확인하세요: npm run server');
            console.log('2. 서버 포트가 3002인지 확인하세요.');
        } else if (error.message.includes('fetch')) {
            console.log('\n💡 해결 방법:');
            console.log('1. Node.js 버전이 18 이상인지 확인하세요.');
            console.log('2. node-fetch 패키지를 설치하세요: npm install node-fetch');
        }
    }
}

// 실행
testScriptGeneration().catch(console.error);
