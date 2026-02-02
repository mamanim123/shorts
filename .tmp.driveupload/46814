const jsonrepair = require('jsonrepair').jsonrepair;

const inputJson = `{
  "title": "밀착 레슨의 충격 반전",
  "titleOptions": [
    "밀착 레슨의 충격 반전",
    "사모님들의 아찔한 골프 레슨",
    "월요일 오후, 골프장의 은밀한 기류"
  ],
  "scriptBody": "월요일 오후 1시, 프라이빗 골프 코스였어.\\n사모님들이 흰색 홀터넥 크롭탑에 새하얀 미니스커트까지 풀세팅으로 나타났지.\\n기세가 그냥… 살벌하더라고.\\n검은색 터틀넥에 슬랙스 입은 젊은 프로는 이미 땀 맺힌 상태였어.\\n사모님들이 프로한테 \\"오늘은 좀 더 밀착 레슨 부탁해요\\" 이러는데 분위기가 묘하게 달아오르더라.\\n프로는 표정 하나 안 변하고 자세를 잡아주는데, 거의 백허그 직전까지 붙는 거야.\\n사모님들은 얼굴이 홍조로 가득하고, 웃음은 계속 터지고.\\n\\"어머, 프로님 손 떨리네? 혹시 나 때문이야?\\" 이런 말까지 나오지 뭐야.\\n심지어 한 사모님은 헛스윙하다 프로 품에 그대로 훅 넘어갔어.\\n그 장면 보고 내가 속으로 ‘와… 진짜 찐이다’ 했지.\\n근데 갑자기 저 멀리서 누가 \\"여보! 자기야! 땀 닦아!\\" 하고 뛰어오는 거야.\\n순간 분위기가 싸—아 하고 식었어.\\n알고 보니 그 프로가 저 사모님들의 아들이었던 거야.\\n그때 사모님들 표정… 그냥 멈춤이었어.\\n나는 말없이 모자를 눌러썼지. 진짜 월요일부터 강한 하루였어.",
  "punchline": "알고 보니 그 프로가 저 사모님들의 아들이었던 거야.",
  "scenes": [
    {
      "sceneNumber": 1,
      "shortPrompt": "Two Korean 40s women in luxurious golf outfits and a male golf pro, high tension on the tee box.",
      "shortPromptKo": "프라이빗 골프 코스에서 긴장감이 감도는 두 40대 사모님과 남성 프로의 모습.",
      "longPrompt": "A group of Korean 40s in their 40s...",
      "longPromptKo": "40대 한국인, 하이엔드 럭셔리 골프장 스타일...",
      "soraPrompt": "Consistent identity...",
      "soraPromptKo": "동일 인물 유지..."
    }
  ]
}`;

try {
    console.log("Testing JSON Parse...");
    const parsed = JSON.parse(inputJson);
    console.log("SUCCESS: JSON Parsed correctly.");
    console.log("Title:", parsed.title);
    console.log("Scenes:", parsed.scenes.length);
} catch (e) {
    console.error("Standard Parse Failed:", e.message);
    console.log("Trying jsonrepair...");
    try {
        const repaired = jsonrepair(inputJson);
        const parsed = JSON.parse(repaired);
        console.log("SUCCESS: JSON Parsed with jsonrepair.");
        console.log("Title:", parsed.title);
    } catch (e2) {
        console.error("jsonrepair Failed:", e2.message);
    }
}
