import { jsonrepair } from 'jsonrepair';

const brokenJson = `{"title":"골프장에서 벌어진 오해와 코믹 반전","scriptBody":"김여사가 골프채를 세게 내리치며 말했다, "오늘, 정말 이상한 사람이 있었어!"\n박프로가 놀란 눈`;

console.log("Original:", brokenJson);

try {
    const repaired = jsonrepair(brokenJson);
    console.log("Repaired:", repaired);
    const parsed = JSON.parse(repaired);
    console.log("Parsed successfully:", parsed);
} catch (e) {
    console.error("Repair/Parse failed:", e.message);
}
