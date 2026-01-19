
const GLAMOUR_KEYWORDS = "Extremely sexy and tight-fitting, Second-skin fit, Perfect body proportions, Voluptuous hourglass figure, Deep plunging neckline, Feminine curves and cleavage emphasized, Sophisticated high-end fashion";

const enhancePromptWithSafeGlamour = (prompt, context = "") => {
    if (!prompt) return "";

    // 1. Check for Foreign Context
    const isForeignRequested = /외국인|foreigner|american|western|white|black|latino|백인|흑인/i.test(context);

    let enhancedPrompt = prompt;

    // 2. Enforce "Korean" Ethnicity (unless foreign)
    if (!isForeignRequested) {
        // Replace generic "Man/Woman" with "Korean Man/Woman" if "Korean" is missing
        enhancedPrompt = enhancedPrompt.replace(/\b(Woman|Man|Girl|Lady|Male|Female)\b/gi, (match) => {
            return `Korean ${match}`;
        });

        // Fix double "Korean Korean"
        enhancedPrompt = enhancedPrompt.replace(/Korean\s+Korean/gi, "Korean");
    }

    // 3. Inject "Maximum Tightness" Keywords for ALL Female Characters
    const hasFemale = /\b(Woman|Girl|Lady|Female)\b/i.test(enhancedPrompt);

    if (hasFemale) {
        // Check if keywords are already there to avoid duplication
        if (!enhancedPrompt.includes("Second-skin fit")) {
            // Append to the end of the prompt
            enhancedPrompt = `${enhancedPrompt}, ${GLAMOUR_KEYWORDS}`;
        }
    }

    return enhancedPrompt;
};

// TEST CASES
const tests = [
    {
        name: "Basic Woman",
        input: "A Woman standing in a park.",
        context: "",
        expectedContains: ["Korean Woman", "Second-skin fit"]
    },
    {
        name: "Already Korean",
        input: "A Korean Woman smiling.",
        context: "",
        expectedContains: ["Korean Woman", "Second-skin fit"],
        expectedNotContains: ["Korean Korean"]
    },
    {
        name: "Foreign Context",
        input: "A Woman in New York.",
        context: "American style",
        expectedContains: ["Woman"],
        expectedNotContains: ["Korean Woman"]
    },
    {
        name: "Multiple Characters",
        input: "A Woman and a Man walking.",
        context: "",
        expectedContains: ["Korean Woman", "Korean Man", "Second-skin fit"]
    },
    {
        name: "No Female",
        input: "A Man driving a car.",
        context: "",
        expectedContains: ["Korean Man"],
        expectedNotContains: ["Second-skin fit"]
    }
];

console.log("Running Tests...\n");

tests.forEach(test => {
    const result = enhancePromptWithSafeGlamour(test.input, test.context);
    let passed = true;

    test.expectedContains?.forEach(str => {
        if (!result.includes(str)) {
            passed = false;
            console.error(`[FAIL] ${test.name}: Expected to contain "${str}"`);
        }
    });

    test.expectedNotContains?.forEach(str => {
        if (result.includes(str)) {
            passed = false;
            console.error(`[FAIL] ${test.name}: Expected NOT to contain "${str}"`);
        }
    });

    if (passed) {
        console.log(`[PASS] ${test.name}`);
    } else {
        console.log(`Result: ${result}\n`);
    }
});
