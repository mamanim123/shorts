const fs = require('fs');
const path = 'f:\\test\\쇼츠대본생성기-v3.7\\engine_config.json';
const config = JSON.parse(fs.readFileSync(path, 'utf8'));

// Revert options to original state
config.options = [
    {
        "id": "V3",
        "title": "비주얼 마스터 V3",
        "desc": "고급스러운 표현과 디테일 강화",
        "iconType": "crown",
        "badge": "Premium"
    },
    {
        "id": "V3_COSTAR",
        "title": "CO-STAR 최적화",
        "desc": "CO-STAR 구조/규칙 적용",
        "iconType": "sparkles",
        "badge": "Structured"
    },
    {
        "id": "NONE",
        "title": "비활성화",
        "desc": "템플릿 기반 모드",
        "iconType": "power",
        "badge": "Off"
    },
    {
        "id": "TEST_ENGINE_API",
        "title": "테스트 엔진",
        "desc": "API 테스트용 엔진",
        "iconType": "custom",
        "badge": "Test"
    }
];

fs.writeFileSync(path, JSON.stringify(config, null, 2), 'utf8');
console.log('Reverted engine_config.json to original state.');
