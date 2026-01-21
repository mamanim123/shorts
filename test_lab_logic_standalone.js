
// Mocking necessary parts for testing
const UNIFIED_OUTFIT_LIST = [
    { id: "golf-001", name: "Navy Slim-fit Polo + White Tailored Golf Pants", categories: ["MALE", "GOLF"] },
    { id: "golf-002", name: "White Performance Polo + Beige Chino Golf Pants", categories: ["MALE", "GOLF"] },
    { id: "casual-001", name: "Black Knit Polo + Dark Indigo Denim", categories: ["MALE", "CASUAL"] },
    { id: "casual-002", name: "Grey Sweater + Navy Chinos", categories: ["MALE", "CASUAL"] }
];

const pickMaleOutfit = (topic = '', excludeOutfits = []) => {
    const isGolfTopic = topic.includes('골프') || topic.includes('golf') || topic.includes('Golf');

    const candidates = UNIFIED_OUTFIT_LIST.filter(item => {
        if (!item.categories.includes('MALE')) return false;
        if (excludeOutfits.includes(item.name)) return false;

        if (isGolfTopic) {
            return item.categories.includes('GOLF');
        }

        return !item.categories.includes('GOLF') || Math.random() > 0.7;
    });

    if (candidates.length === 0) {
        return isGolfTopic ? 'Navy Slim-fit Polo + White Tailored Golf Pants' : 'Black Knit Polo + Dark Indigo Denim';
    }

    return candidates[Math.floor(Math.random() * candidates.length)].name;
};

function test() {
    console.log('--- Testing Male Outfit Selection (Self-Contained) ---');

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
