
import fs from 'fs';

const filePath = 'f:/projact/쇼츠대본생성기-v3.5.3/server/index.js';

try {
    const data = fs.readFileSync(filePath, 'utf8');

    // Strengthen the JSON requirement
    const oldPromptPart = '[IMPORTANT] All outputs must be in KOREAN. (모든 출력은 반드시 한국어로 작성하세요.)\n\nNow process the input and output ONLY valid JSON (no other text, no markdown):';
    const newPromptPart = '[IMPORTANT] All outputs must be in KOREAN. (모든 출력은 반드시 한국어로 작성하세요.)\n\n[STRICT RULE] DO NOT include any conversational filler like "Sure", "Here is", or "Okay". Output ONLY the raw JSON object.\n\nNow process the input and output ONLY valid JSON (no other text, no markdown):';

    const updatedData = data.replace(oldPromptPart, newPromptPart);

    if (data === updatedData) {
        console.error("Replacement failed: oldPromptPart not found identically.");
    } else {
        fs.writeFileSync(filePath, updatedData, 'utf8');
        console.log("JSON instruction strengthened.");
    }
} catch (err) {
    console.error("Update failed:", err);
}
