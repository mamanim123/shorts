
const fs = require('fs');
const path = 'f:/test/쇼츠대본생성기-v6/services/geminiService.ts';

try {
    const content = fs.readFileSync(path, 'utf8');
    console.log(`Read ${content.length} bytes.`);

    // Search for post-processing logic
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        if (line.includes('Tight') || line.includes('Mini') || line.includes('replace') || line.includes('scenes.map')) {
            // Print context
            if (line.trim().length < 200) { // Avoid printing huge minified lines if any
                console.log(`Line ${index + 1}: ${line.trim()}`);
            }
        }
    });

    // Also check for "40s" logic specifically
    console.log("\n--- Checking for 40s logic ---");
    lines.forEach((line, index) => {
        if (line.includes('40s') && (line.includes('Outfit') || line.includes('style'))) {
            console.log(`Line ${index + 1}: ${line.trim()}`);
        }
    });

} catch (err) {
    console.error("Error reading file:", err);
}
