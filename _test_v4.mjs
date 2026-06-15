const TECH_TAIL = "photorealistic, cinematic lighting, 8k, vertical 9:16, no watermark";

// 첫 첨부 rawAssignment의 실제 LLM imagePrompt (scene 1)
const scene = {
  characterIds: ["WomanA"],
  imagePrompt: "unfiltered raw photograph, close-up, a stunning Korean woman in her 40s resting her chin on her hand inside a modern white golf cart, beautiful golf course with blooming flowers, 8k"
};
// 실제 outfitMap (WomanA 고정 의상)
const outfitMap = new Map([
  ["WomanA", { name: "luxury slim-fit white golf knit top, white pleated skirt, visor cap", prompt: "luxury slim-fit white golf knit top, white pleated skirt, visor cap" }]
]);

// 패치된 ON 모드 로직 복제
const rawLlmPrompt = String(scene.imagePrompt || "").trim();
const outfitLock = scene.characterIds
  .map((id) => { const o = outfitMap.get(id); return o ? `wearing ${o.prompt || o.name}` : ""; })
  .filter(Boolean).join(", ");
const onModePrompt = outfitLock
  ? `${rawLlmPrompt}, ${outfitLock}, exact outfit colors, no hue shift, no color variation, ${TECH_TAIL}`
  : rawLlmPrompt;

console.log("=== ON 모드 결과 prompt ===");
console.log(onModePrompt);
console.log("");
console.log("의상 결합됨:", onModePrompt.includes("wearing"));
console.log("색상고정 결합됨:", onModePrompt.includes("no hue shift"));
