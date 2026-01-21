
const adjustOutfitForSeason = (outfit, topic) => {
    const isWinter = topic.includes('눈') || topic.includes('겨울') || topic.includes('snow') || topic.includes('winter') || topic.includes('Snow') || topic.includes('Winter');

    if (!isWinter) return outfit;

    let adjusted = outfit;

    if (adjusted.toLowerCase().includes('long-sleeve')) return adjusted;

    const replacements = {
        'Sleeveless': 'Long-sleeved',
        'Short-sleeve': 'Long-sleeve',
        'Halter-neck': 'Long-sleeved Halter-neck',
        'Off-shoulder': 'Long-sleeved Off-shoulder',
        'Cap-sleeve': 'Long-sleeved'
    };

    let replaced = false;
    for (const [key, val] of Object.entries(replacements)) {
        const regex = new RegExp(key, 'gi');
        if (regex.test(adjusted)) {
            adjusted = adjusted.replace(regex, val);
            replaced = true;
        }
    }

    if (adjusted.toLowerCase().includes('tube top')) {
        adjusted = adjusted.replace(/tube top/gi, 'Long-sleeved Tube Top');
        replaced = true;
    }

    if (!replaced && !adjusted.toLowerCase().includes('long-sleeve')) {
        const topItems = ['Knit', 'Blouse', 'Polo', 'Shirt', 'Tee', 'Top', 'One-piece', 'Dress'];
        for (const item of topItems) {
            if (adjusted.includes(item)) {
                adjusted = adjusted.replace(item, `Tight-fitting Long-sleeve ${item}`);
                break;
            }
        }
    }

    if (!adjusted.toLowerCase().includes('tight')) {
        adjusted = 'Tight-fitting ' + adjusted;
    }

    return adjusted;
};

const tests = [
    { topic: "눈 오는 날", outfit: "White Halter-neck Tight Crop Top", expected: "Tight-fitting White Long-sleeved Halter-neck Tight Crop Top" }, // Tight added at front
    { topic: "겨울 필드", outfit: "White Off-shoulder Tube Top", expected: "Tight-fitting White Long-sleeved Off-shoulder Long-sleeved Tube Top" }, // Replaced twice
    { topic: "눈보라", outfit: "Lavender Crop Tank Top", expected: "Tight-fitting Lavender Crop Tight-fitting Long-sleeve Tank Top" }, // Knit/Blouse logic
    { topic: "겨울", outfit: "Black Lace Corset Top", expected: "Tight-fitting Black Lace Corset Tight-fitting Long-sleeve Top" }
];

console.log('--- Refined Seasonal Outfit Adjustment Tests ---');
tests.forEach((t, i) => {
    const result = adjustOutfitForSeason(t.outfit, t.topic);
    const passed = result.toLowerCase().includes('long-sleeve') && (t.outfit.toLowerCase().split(' ').some(word => result.toLowerCase().includes(word)));
    console.log(`Test ${i + 1}: ${result}`);
    console.log(`  Midriff Keyword Preserved: ${t.outfit.match(/Crop|Tube|Corset|Tank/i) ? result.match(/Crop|Tube|Corset|Tank/i) !== null : 'N/A'}`);
});
