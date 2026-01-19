// 이미지 자동 저장 테스트 스크립트
const testPrompt = "A beautiful Korean woman in her 40s wearing a pink polo shirt and white golf skirt, standing on a golf course at sunset, photorealistic, high quality";

console.log("=== 이미지 자동 저장 테스트 시작 ===");
console.log("프롬프트:", testPrompt);

fetch('http://localhost:3002/api/image/ai-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        prompt: testPrompt,
        service: 'GEMINI',
        storyId: 'test_' + Date.now(),
        sceneNumber: 1,
        autoCapture: true
    })
})
    .then(res => res.json())
    .then(data => {
        console.log("✅ 성공:", data);
        console.log("저장된 경로:", data.imagePath);
    })
    .catch(err => {
        console.error("❌ 실패:", err);
    });
