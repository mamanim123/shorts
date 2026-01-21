
import { useState, useEffect, useCallback } from 'react';

export interface TemplateItem {
    id: string;
    label: string;
    description: string; // List view summary
    prompt: string;      // Actual AI instructions
}

export interface TemplateConfig {
    genres: TemplateItem[];
    tones: TemplateItem[];
}

const GENERIC_STYLE_GUIDE = `** 스타일 가이드:**
- ** 나래이션 **: 상황에 따라 부드러운 독백이나 감성적인 어조 사용.
- ** 대사 **: 캐릭터의 성격에 맞는 자연스러운 말투.
- ** 지문 금지 **: 대본에 괄호()로 된 지문이나 '블랙아웃' 같은 연출 용어를 쓰지 마세요.`;

const DEFAULT_GENRES: TemplateItem[] = [
    {
        id: 'hit_twist',
        label: '🌶️ 대박 반전 (매운맛)',
        description: '100만 조회수 보장! 섹시한 오해와 건전한 반전의 아슬아슬한 줄타기',
        prompt: `**[대박 반전(섹드립) 장르 전문 프롬프트]**\n\n**핵심 컨셉**: "야한 줄 알았는데 아니었네?" (Double Entendre)\n\n**[성공 공식: 오해 → 빌드업 → 허무/건전 반전]**\n1. **도입부 (Hook)**: 시청자가 100% "19금 상황"이라고 착각하게 만드는 **자극적이고 중의적인 대사**로 시작하세요. (키워드: 넣다, 싸다, 굵다, 벗다, 홍콩, 젖다, 딱딱하다 등)\n2. **전개 (Misunderstanding)**: 주변 사람들은 얼굴을 붉히거나 당황하지만, 당사자들은 **너무나 태연하고 진지하게** 대화를 이어가야 합니다. 긴장감을 고조시키세요.\n3. **반전 (Twist)**: 결말은 반드시 **지극히 건전하고 일상적인 행위**여야 합니다. (예: 주사 놓기, 때 밀기, 농사 짓기, 넥타이 매기, 헬스 운동 등)\n\n**[필수 스타일 가이드]**\n- **능청스러운 연기**: 캐릭터들은 절대 웃지 않고 진지하게 "그 행위"에 몰입해야 합니다.\n- **대사 톤**: "자기야, 조금만 더 깊숙이 넣어봐...", "어머, 선생님 너무 굵어요..." 처럼 **숨소리가 들리는 듯한 야릇한 톤**을 지문에 묘사하세요.\n- **금지**: 진짜 성적인 행위는 절대 금지. 오직 **말장난과 상황의 오해**로만 승부하세요.`
    },
    {
        id: 'twist',
        label: '반전썰',
        description: '친구에게 썰 풀듯 이야기하는 반전 중심 스토리',
        prompt: `**[반전썰 전문 스타일 가이드]**\n- **나래이션 어미**: "~했어", "~했지", "~이랬는데", "~하더라고", "~거야" (친구한테 썰 풀듯이 반말 필수)\n- **절대 금지**: "~했습니다", "~합니다", "~한다" (딱딱한 문어체/경어체 절대 금지)\n- **메타 발언 금지**: "자, 들어봐", "반전 간다", "대박이지?" 같은 추임새 금지. 오직 **스토리 내용**만 말하세요.\n- **구성**: 나래이션 80% (빠른 전개), 대사 20% (임팩트)\n- **지문/해설 금지**: (블랙아웃), (웃으며) 같은 지문 금지. 입 밖으로 소리 내는 말만 적으세요.`
    },
    {
        id: 'humor',
        label: '유머',
        description: '가볍고 유쾌한 분위기, 웃음 유발',
        prompt: `**[유머 장르 지침]**\n가볍고 유쾌한 분위기로 시청자의 웃음을 유발하세요.\n\n${GENERIC_STYLE_GUIDE}`
    },
    {
        id: 'touching',
        label: '감동',
        description: '따뜻하고 감동적인 이야기, 눈물샘 자극',
        prompt: `**[감동 장르 지침]**\n따뜻하고 감동적인 이야기로 시청자의 눈물샘을 자극하세요. 인간미 넘치는 에피소드를 다루세요.\n\n${GENERIC_STYLE_GUIDE}`
    },
    {
        id: 'kdrama',
        label: 'K-드라마 역전극',
        description: '무시당하던 주인공이 성공하는 사이다 역전극',
        prompt: `**[K-드라마 역전극 전용 프롬프트]**\n\n**역할**: K-드라마 스타일 숏폼 전문 스토리텔러.\n\n**[벤치마킹 성공 공식]**\n1. **구조**: ⚡️ 훅(3초 내) → 🔨 갈등(빌드업) → 💥 대결/행동(클라이맥스) → 🏆 사이다 반전(카타르시스)\n2. **톤**: 하이엔드 럭셔리 & 갑을 관계 역전극\n3. **핵심 플롯**: 겉모습으로 무시당하던 주인공이 압도적인 실력/지위로 상대를 제압\n\n**[필수 요소]**\n- **주인공 A의 무시당하는 요소**: 허름한 옷차림, 젊은 나이, 수수한 악세사리 등\n- **최종 반전 지위/능력**: 은퇴한 챔피언, 회장님의 손자, 진짜 건물주 등\n\n**[스타일 가이드]**\n- **나레이션**: 드라마틱하고 긴장감 있는 어조 ("~했다", "~였다")\n- **대사**: 갑질 캐릭터는 거만하게, 주인공은 침착하고 냉정하게\n- **지문 금지**: 괄호() 사용 금지`
    },
    {
        id: 'romance',
        label: '로맨스',
        description: '설레는 로맨스, 연애 감정 자극',
        prompt: `**[로맨스 장르 지침]**\n두 남녀 사이의 미묘한 기류와 설레는 감정을 강조하세요. 심쿵 포인트를 만들어주세요.\n\n${GENERIC_STYLE_GUIDE}`
    },
    {
        id: 'daily',
        label: '일상',
        description: '공감 가는 일상 소재, 소소한 재미',
        prompt: `**[일상 장르 지침]**\n누구나 겪어봤을 법한 공감 가는 일상 소재를 다루세요. 소소한 재미와 리얼리티를 살려주세요.\n\n${GENERIC_STYLE_GUIDE}`
    },
    {
        id: 'work',
        label: '직장',
        description: '직장 생활 애환, 상사 뒷담화, 공감',
        prompt: `**[직장 장르 지침]**\n직장인들의 리얼한 현실과 애환, 상사 뒷담화 등을 공감 가 게 그려주세요.\n\n${GENERIC_STYLE_GUIDE}`
    },
    {
        id: 'family',
        label: '가족',
        description: '가족 간의 에피소드, 부부/고부 갈등',
        prompt: `**[가족 장르 지침]**\n가족 간의 현실적인 에피소드, 부부 갈등이나 고부 갈등 등을 리얼하게 다루세요.\n\n${GENERIC_STYLE_GUIDE}`
    }
];

const DEFAULT_TONES: TemplateItem[] = [
    {
        id: 'humorous',
        label: '유머러스',
        description: '유쾌하고 재치 있는 어조',
        prompt: `유쾌하고 재치 있는 어조를 사용하세요. 시청자를 웃게 만드는 위트 있는 표현을 사용하세요.\n\n${GENERIC_STYLE_GUIDE}`
    },
    {
        id: 'serious',
        label: '진지한',
        description: '진지하고 무게감 있는 어조',
        prompt: `진지하고 무게감 있는 어조를 사용하세요. 가벼운 농담은 배제하고 메시지 전달에 집중하세요.\n\n${GENERIC_STYLE_GUIDE}`
    },
    {
        id: 'tense',
        label: '긴장감',
        description: '긴장감 넘치고 스릴 있는 어조',
        prompt: `긴장감 넘치고 스릴 있는 어조를 사용하세요. 숨 막히는 전개와 빠른 호흡을 유지하세요.\n\n${GENERIC_STYLE_GUIDE}`
    },
    {
        id: 'warm',
        label: '따뜻한',
        description: '부드럽고 감성적인 어조',
        prompt: `부드럽고 따뜻한 감성적인 어조를 사용하세요. 위로와 힐링을 주는 말투를 사용하세요.\n\n${GENERIC_STYLE_GUIDE}`
    },
    {
        id: 'cynical',
        label: '시니컬',
        description: '냉소적이고 비판적인 어조',
        prompt: `냉소적이고 비판적인 어조를 사용하세요. 세상을 삐딱하게 바라보는 시선을 유지하세요.\n\n${GENERIC_STYLE_GUIDE}`
    },
    {
        id: 'black_comedy',
        label: '블랙코미디(매운맛)',
        description: '풍자와 해학, 다소 자극적인 매운맛',
        prompt: `**[고급 성인유머 / 은유(Innuendo) 전용 지침]**\n\n이 대본의 핵심은 **"야한 단어를 하나도 쓰지 않고 야한 상상을 하게 만드는 것"**입니다. **"시청자의 음란마귀"**를 이용하세요.\n\n**[절대 금지 🚫]**\n- **1차원적 성적 단어 금지**: "신음", "젖었어", "박아", "섹스", "알몸" 등 노골적인 단어 절대 사용 금지!\n- **신분 반전 금지**: "사실 나는 경찰이었다" 같은 노잼 반전 금지\n\n**[필수 전략]**\n1. **절대 금지**: 초반 나래이션에서 "상황 설명" 절대 금지! (예: "골프를 치는데..." -> 탈락)\n2. **시작(Hook)**: 다짜고짜 **"야릇한 대사"**나 **"오해를 부르는 행동"**으로 시작.\n3. **중반(Mislead)**: 주변 반응이나 대사로 오해 증폭. (시청자가 "와 이건 100%다"라고 믿게 만듦)\n4. **반전(Twist)**: 줌아웃하며 **전체 상황** 공개 (알고 보니 요가 중, 빨래 중 등 건전한 상황)\n5. **Punchline**: 허무해하는 반응과 함께 즉시 종료.\n\n**[핵심 철학]**\n- **"대본은 야하지 않습니다. 시청자의 음란마귀가 야할 뿐입니다."**\n- 주제에 맞춰 이중적인 의미를 가진 소재(동사)를 찾아내세요. (예: 박다->못/텐트, 싸다->짐/김밥)`
    }
];

const dedupeById = (items: TemplateItem[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
};

export const useTemplateManager = () => {
    console.log("DEBUG: useTemplateManager Hook Called");
    const [genres, setGenres] = useState<TemplateItem[]>([]);
    const [tones, setTones] = useState<TemplateItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchConfig = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('http://localhost:3002/api/templates/config');
            if (!res.ok) throw new Error('Failed to fetch config');
            const data = await res.json();

            // If empty (first run or valid empty file), use defaults and save them
            // We use lax check: if genres OR tones is empty, we restore defaults for that part?
            // Actually, let's treat them as a set. If both are empty, init defaults.
            // If user deletes all, they might want empty. But providing defaults is safer for "Not Visible" issue.

            let initialGenres = data.genres || [];
            let initialTones = data.tones || [];

            if (initialGenres.length === 0 && initialTones.length === 0) {
                await saveConfig({ genres: DEFAULT_GENRES, tones: DEFAULT_TONES });
                initialGenres = DEFAULT_GENRES;
                initialTones = DEFAULT_TONES;
            }

            setGenres(dedupeById(initialGenres));
            setTones(dedupeById(initialTones));
        } catch (err) {
            console.error(err);
            // Fallback to defaults on error
            setGenres(dedupeById(DEFAULT_GENRES));
            setTones(dedupeById(DEFAULT_TONES));
        } finally {
            setLoading(false);
        }
    }, []);

    const saveConfig = async (newConfig: TemplateConfig) => {
        try {
            const res = await fetch('http://localhost:3002/api/templates/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            });
            if (!res.ok) throw new Error('Failed to save config');
        } catch (err) {
            console.error(err);
            setError('템플릿 저장에 실패했습니다.');
        }
    };

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const reorderList = (list: TemplateItem[], startIndex: number, endIndex: number) => {
        const result = [...list];
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result;
    };

    const addGenre = async (item: TemplateItem) => {
        const newGenres = [...genres, item];
        setGenres(newGenres);
        await saveConfig({ genres: newGenres, tones });
    };

    const updateGenre = async (id: string, updated: Partial<TemplateItem>) => {
        const newGenres = genres.map(g => g.id === id ? { ...g, ...updated } : g);
        setGenres(newGenres);
        await saveConfig({ genres: newGenres, tones });
    };

    const deleteGenre = async (id: string) => {
        const newGenres = genres.filter(g => g.id !== id);
        setGenres(newGenres);
        await saveConfig({ genres: newGenres, tones });
    };

    const addTone = async (item: TemplateItem) => {
        const newTones = [...tones, item];
        setTones(newTones);
        await saveConfig({ genres, tones: newTones });
    };

    const updateTone = async (id: string, updated: Partial<TemplateItem>) => {
        const newTones = tones.map(t => t.id === id ? { ...t, ...updated } : t);
        setTones(newTones);
        await saveConfig({ genres, tones: newTones });
    };

    const deleteTone = async (id: string) => {
        const newTones = tones.filter(t => t.id !== id);
        setTones(newTones);
        await saveConfig({ genres, tones: newTones });
    };

    const reorderGenres = async (startIndex: number, endIndex: number) => {
        if (startIndex === endIndex) return;
        const newGenres = reorderList(genres, startIndex, endIndex);
        setGenres(newGenres);
        await saveConfig({ genres: newGenres, tones });
    };

    const reorderTones = async (startIndex: number, endIndex: number) => {
        if (startIndex === endIndex) return;
        const newTones = reorderList(tones, startIndex, endIndex);
        setTones(newTones);
        await saveConfig({ genres, tones: newTones });
    };

    return {
        genres,
        tones,
        loading,
        error,
        addGenre,
        updateGenre,
        deleteGenre,
        addTone,
        updateTone,
        deleteTone,
        reorderGenres,
        reorderTones,
        refresh: fetchConfig
    };
};
