
import { generateHybridStory } from './services/hybridService';
import { UserInput, EngineVersion, OutfitStyle, ScenarioMode, Dialect } from './types';

const testInput: UserInput = {
    engineVersion: 'V3',
    category: OutfitStyle.SIGNATURE,
    scenarioMode: ScenarioMode.DOUBLE_ENTENDRE,
    dialect: Dialect.STANDARD,
    customContext: '등산',
    targetService: 'HYBRID'
};

async function test() {
    console.log("=== Testing Variations for '등산' ===");

    // Run 3 times to see different keywords
    for (let i = 1; i <= 3; i++) {
        const story = await generateHybridStory(testInput);
        console.log(`\n[Attempt ${i}]`);
        // Extract key lines that show the variation
        const lines = story.scriptBody.split('\n');
        // Find lines with the variable parts
        const keyLine1 = lines.find(l => l.includes("주운"));
        const keyLine2 = lines.find(l => l.includes("오빠, 왜 내 거"));

        console.log("Variation Found:");
        if (keyLine1) console.log("   " + keyLine1.trim());
        if (keyLine2) console.log("   " + keyLine2.trim());
    }
}

test();
