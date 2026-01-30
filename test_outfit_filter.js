const cleavageKeywords = [
    /deep\s*v[-\s]?neck(?:line)?/gi,
    /deep\s*neck(?:line)?/gi,
    /plunging\s*neckline/gi,
    /\bcleavage\b/gi,
    /\blow-cut\b/gi,
    /\bopen-chest\b/gi
];

const shoulderExposureKeywords = [
    { key: 'Off-shoulder', replacement: 'Off-shoulder tight-fitting long-sleeve' },
    { key: 'One-shoulder', replacement: 'One-shoulder tight-fitting long-sleeve' },
    { key: 'Cold-shoulder', replacement: 'Cold-shoulder tight-fitting long-sleeve' },
    { key: 'Cowl-neck', replacement: 'Elegant cowl-neck tight-fitting long-sleeve' },
    { key: 'Halter-neck', replacement: 'Elegant high-cut off-shoulder long-sleeve' }
];

function testConvert(outfit) {
    let newTop = outfit;
    let isCleavageBlocked = false;
    cleavageKeywords.forEach((regex) => {
        if (regex.test(newTop)) {
            if (newTop.toLowerCase().includes('knit')) {
                newTop = newTop.replace(regex, 'Elegant boat-neck fitted');
            } else {
                newTop = newTop.replace(regex, 'Elegant mock-neck fitted');
            }
            isCleavageBlocked = true;
        }
    });

    let isSleeveUpdated = false;
    shoulderExposureKeywords.forEach(({ key, replacement }) => {
        const regex = new RegExp(key, 'gi');
        if (regex.test(newTop)) {
            newTop = newTop.replace(regex, replacement);
            isSleeveUpdated = true;
        }
    });

    console.log(`Original: ${outfit}`);
    console.log(`Result: ${newTop}`);
    console.log('---');
}

console.log('--- Cleavage Test ---');
testConvert('Deep V-neck Silk Blouse');
testConvert('Low-cut Cleavage Dress');
testConvert('Plunging neckline Red Knit');

console.log('--- Shoulder Exposure Test ---');
testConvert('Off-shoulder White Blouse');
testConvert('One-shoulder Elegant Dress');
testConvert('Halter-neck Summer Top');

console.log('--- Combined Test ---');
testConvert('Off-shoulder Deep V-neck Knit');
