
import fs from 'fs';

const filePath = 'f:/projact/쇼츠대본생성기-v3.5.3/server/index.js';

try {
    const data = fs.readFileSync(filePath, 'utf8');

    // Change "VIDEO PROMPT" to "DYNAMIC SCENE DESCRIPTION" to avoid conversational triggers
    let updatedData = data.replace('[TASK: VIDEO PROMPT + DIALOGUE SEPARATION]', '[TASK: DYNAMIC SCENE + DIALOGUE SEPARATION]');
    updatedData = updatedData.replace('"videoPrompt": A cinematic scene description', '"sceneDescription": A cinematic moving scene description');
    updatedData = updatedData.replace('"videoPrompt" must describe:', '"sceneDescription" must describe:');
    updatedData = updatedData.replace('"videoPrompt": "시각적 장면 설명만 (대사 제외)"', '"sceneDescription": "시각적 움직임이 있는 장면 설명 (대사 제외)"');
    updatedData = updatedData.replace('refinedPrompt = parsed.videoPrompt || \'\';', 'refinedPrompt = parsed.sceneDescription || parsed.videoPrompt || \'\';');

    if (data === updatedData) {
        console.error("Replacement failed: target strings not found.");
    } else {
        fs.writeFileSync(filePath, updatedData, 'utf8');
        console.log("Trigger words bypassed in prompt.");
    }
} catch (err) {
    console.error("Update failed:", err);
}
