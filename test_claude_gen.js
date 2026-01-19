
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Read constants.ts to get the latest SYSTEM_PROMPT_CLAUDE
const constantsPath = path.join(__dirname, 'constants.ts');
const constantsContent = fs.readFileSync(constantsPath, 'utf8');

// Extract SYSTEM_PROMPT_CLAUDE using regex
const match = constantsContent.match(/export const SYSTEM_PROMPT_CLAUDE = `([\s\S]*?)`;/);
if (!match) {
    console.error("Could not find SYSTEM_PROMPT_CLAUDE in constants.ts");
    process.exit(1);
}
const systemPrompt = match[1];

// 2. Construct the User Prompt (Simulating geminiService.ts)
const userPrompt = `
Topic: Golf Scandal
Context: A wife catches her husband cheating on the golf course.
Target Age: 40s

[LOCKED VARIABLES]
Woman A: Korean woman, Bob hair, Red Dress
Woman B: Korean woman, Long hair, Blue Skirt
Woman C: Korean woman, Ponytail, White Shorts
`;

const fullPrompt = `
${systemPrompt}

---

${userPrompt}

IMPORTANT: Respond ONLY with the valid JSON. No markdown, no explanations.
`;

// 3. Call the API
async function testGen() {
    console.log("Sending request to Claude...");
    try {
        const response = await fetch('http://localhost:3002/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service: 'CLAUDE',
                prompt: fullPrompt
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("--- SUCCESS ---");
        console.log(JSON.stringify(data, null, 2));

        // Validation
        if (data.scriptBody && !data.scriptBody.includes("Generated Script Here")) {
            console.log("✅ VALIDATION PASSED: Content is generated.");
        } else {
            console.log("❌ VALIDATION FAILED: Content looks like placeholder.");
        }

    } catch (error) {
        console.error("--- ERROR ---");
        console.error(error);
    }
}

testGen();
