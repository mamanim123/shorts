
// Node.js 18+ has native fetch
const data = {
    title: "테스트 대본",
    content: "이것은 테스트 대본입니다.\n저장이 잘 되는지 확인합니다."
};

fetch('http://localhost:3002/api/save-story', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
})
    .then(res => res.json())
    .then(json => {
        console.log("Response:", json);
    })
    .catch(err => {
        console.error("Error:", err);
    });
