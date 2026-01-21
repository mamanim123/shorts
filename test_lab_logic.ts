
import { pickMaleOutfit } from './services/labPromptBuilder';
import { UNIFIED_OUTFIT_LIST } from './constants';

function test() {
    console.log('--- Testing Male Outfit Selection ---');

    // 1. Test Golf Topic
    console.log('\n[Case 1: Golf Topic]');
    const golfTopic = "골프장에서 친구와 내기 골프 중";
    const outfit1 = pickMaleOutfit(golfTopic, []);
    const outfit2 = pickMaleOutfit(golfTopic, [outfit1]);

    console.log(`Topic: ${golfTopic}`);
    console.log(`ManA Outfit: ${outfit1}`);
    console.log(`ManB Outfit: ${outfit2}`);

    const isGolf1 = UNIFIED_OUTFIT_LIST.find(o => o.name === outfit1)?.categories.includes('GOLF');
    const isGolf2 = UNIFIED_OUTFIT_LIST.find(o => o.name === outfit2)?.categories.includes('GOLF');

    console.log(`ManA is Golf: ${isGolf1}`);
    console.log(`ManB is Golf: ${isGolf2}`);
    console.log(`Different outfits: ${outfit1 !== outfit2}`);

    // 2. Test Casual Topic
    console.log('\n[Case 2: Casual Topic]');
    const casualTopic = "집 앞 카페에서 수다";
    const casual1 = pickMaleOutfit(casualTopic, []);
    const casual2 = pickMaleOutfit(casualTopic, [casual1]);

    console.log(`Topic: ${casualTopic}`);
    console.log(`ManA Casual: ${casual1}`);
    console.log(`ManB Casual: ${casual2}`);
    console.log(`Different outfits: ${casual1 !== casual2}`);
}

test();
