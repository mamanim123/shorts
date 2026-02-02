
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
    console.log("Testing Hybrid Generation with context: '등산'...");
    try {
        const story = await generateHybridStory(testInput);
        console.log("=== Hybrid Story Generated ===");
        console.log("Title:", story.title);
        console.log("PUNCHLINE:", story.punchline);
        console.log("SCRIPT BODY:\n", story.scriptBody);
        console.log("SCENES:", story.scenes.length);
        console.log("First Prompt:", story.scenes[0].shortPrompt);
    } catch (e) {
        console.error("Test Failed:", e);
    }
}

test();
