const shoulderExposureKeywords = [
    { key: 'Off-shoulder', replacement: 'Off-shoulder tight-fitting long-sleeve' },
    { key: 'One-shoulder', replacement: 'One-shoulder tight-fitting long-sleeve' },
    { key: 'Cold-shoulder', replacement: 'Cold-shoulder tight-fitting long-sleeve' },
    { key: 'Cowl-neck', replacement: 'Elegant cowl-neck tight-fitting long-sleeve' },
    { key: 'Halter-neck', replacement: 'Elegant high-cut off-shoulder long-sleeve' }
];

function testConvert(outfit) {
    let newTop = outfit;
    shoulderExposureKeywords.forEach(({ key, replacement }) => {
        const regex = new RegExp(key, 'gi');
        if (regex.test(newTop)) {
            newTop = newTop.replace(regex, replacement);
        }
    });

    console.log(`Original: ${outfit}`);
    console.log(`Result: ${newTop}`);
    console.log('---');
}

console.log('--- Shoulder Exposure Test ---');
testConvert('Off-shoulder White Blouse');
testConvert('One-shoulder Elegant Dress');
testConvert('Halter-neck Summer Top');
