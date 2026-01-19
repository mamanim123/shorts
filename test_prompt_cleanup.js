
const qualitySuffix = ", Volumetric lighting, Rim light, Detailed skin texture, 8k uhd, High fashion photography, masterpiece, depth of field --ar 9:16 --style raw --stylize 250";

const tagsToRemove = [
    "photorealistic", "8k resolution", "cinematic lighting", "masterpiece",
    "professional photography", "depth of field", "--ar 9:16", "--style raw",
    "detailed texture", "magazine cover quality", "hyper-realistic"
];

const cleanPrompt = (text) => {
    let cleaned = text;
    tagsToRemove.forEach(tag => {
        const regex = new RegExp(tag.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
        cleaned = cleaned.replace(regex, "");
    });
    return cleaned.replace(/,\s*,/g, ",").trim().replace(/,$/, "");
};

const tests = [
    {
        name: "Duplicate Removal",
        input: "A beautiful woman, photorealistic, 8k resolution, cinematic lighting --ar 9:16",
        expectedNotContains: ["photorealistic", "8k resolution", "--ar 9:16"],
        expectedSuffix: true
    },
    {
        name: "Clean Input",
        input: "A cat sitting on a wall",
        expectedNotContains: [],
        expectedSuffix: true
    },
    {
        name: "Mixed Case",
        input: "A dog, PhotoRealistic, 8K RESOLUTION",
        expectedNotContains: ["PhotoRealistic", "8K RESOLUTION"],
        expectedSuffix: true
    }
];

console.log("Running Cleanup Tests...\n");

tests.forEach(test => {
    let result = cleanPrompt(test.input) + qualitySuffix;
    let passed = true;

    test.expectedNotContains?.forEach(str => {
        // Check if the *original* specific string is gone (case-insensitive check in logic, but here we check result)
        // Actually, the result WILL contain "8k uhd" from suffix, but shouldn't contain "8k resolution" from input.
        if (result.includes(str) && !qualitySuffix.includes(str)) {
            // Only fail if it's not part of the new suffix
            passed = false;
            console.error(`[FAIL] ${test.name}: Found forbidden "${str}"`);
        }
    });

    if (!result.includes("Volumetric lighting")) {
        passed = false;
        console.error(`[FAIL] ${test.name}: Missing Quality Suffix`);
    }

    if (passed) {
        console.log(`[PASS] ${test.name}`);
    } else {
        console.log(`Result: ${result}\n`);
    }
});
