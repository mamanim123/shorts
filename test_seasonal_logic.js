
const adjustOutfitForSeason = (outfit, topic) => {
    const isWinter = topic.includes('눈') || topic.includes('겨울') || topic.includes('snow') || topic.includes('winter') || topic.includes('Snow') || topic.includes('Winter');

    if (!isWinter) return outfit;

    let adjusted = outfit;

    if (adjusted.toLowerCase().includes('long-sleeve')) return adjusted;

    const replacements = {
        'Sleeveless': 'Tight-fitting Long-sleeve',
        'Short-sleeve': 'Tight-fitting Long-sleeve',
        'Halter-neck': 'High-neck Tight Long-sleeve',
        'Tube Top': 'Tight-fitting Long-sleeve Layered',
        'Off-shoulder': 'Tight-fitting Long-sleeve',
        'Cap-sleeve': 'Tight-fitting Long-sleeve'
    };

    for (const [key, val] of Object.entries(replacements)) {
        const regex = new RegExp(key, 'gi');
        if (regex.test(adjusted)) {
            adjusted = adjusted.replace(regex, val);
            return adjusted;
        }
    }

    const topItems = ['Knit', 'Blouse', 'Polo', 'Shirt', 'Tee', 'Top', 'One-piece', 'Dress'];
    for (const item of topItems) {
        if (adjusted.includes(item)) {
            adjusted = adjusted.replace(item, `Tight-fitting Long-sleeve ${item}`);
            break;
        }
    }

    return adjusted;
};

const tests = [
    { topic: "눈 오는 날", outfit: "White Sleeveless Turtleneck", expected: "White Tight-fitting Long-sleeve Turtleneck" },
    { topic: "겨울 풍경", outfit: "Pink & White Striped Knit", expected: "Pink & White Striped Tight-fitting Long-sleeve Knit" },
    { topic: "Summer breeze", outfit: "Pink Sleeveless Polo", expected: "Pink Sleeveless Polo" }, // No change
    { topic: "Heavy snow", outfit: "Tight Golf Mini One-piece (Belted)", expected: "Tight Golf Mini Tight-fitting Long-sleeve One-piece (Belted)" },
    { topic: "눈보라", outfit: "Already Long-sleeve Shirt", expected: "Already Long-sleeve Shirt" } // No change
];

console.log('--- Seasonal Outfit Adjustment Tests ---');
tests.forEach((t, i) => {
    const result = adjustOutfitForSeason(t.outfit, t.topic);
    const passed = result === t.expected;
    console.log(`Test ${i + 1}: ${passed ? 'PASS' : 'FAIL'}`);
    if (!passed) {
        console.log(`  Topic: ${t.topic}`);
        console.log(`  Input: ${t.outfit}`);
        console.log(`  Expected: ${t.expected}`);
        console.log(`  Result: ${result}`);
    } else {
        console.log(`  Result: ${result}`);
    }
});
