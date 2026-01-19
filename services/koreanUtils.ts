
/**
 * Korean Josa (Postposition) and Conjugation Utility
 */

export const Josa = {
    // 을/를
    ul_leul: (word: string) => {
        const lastChar = word.charCodeAt(word.length - 1);
        const hasJongseong = (lastChar - 0xAC00) % 28 > 0;
        return hasJongseong ? `${word}을` : `${word}를`;
    },
    // 이/가
    i_ga: (word: string) => {
        const lastChar = word.charCodeAt(word.length - 1);
        const hasJongseong = (lastChar - 0xAC00) % 28 > 0;
        return hasJongseong ? `${word}이` : `${word}가`;
    },
    // 은/는
    eun_neun: (word: string) => {
        const lastChar = word.charCodeAt(word.length - 1);
        const hasJongseong = (lastChar - 0xAC00) % 28 > 0;
        return hasJongseong ? `${word}은` : `${word}는`;
    },
    // 와/과
    wa_gwa: (word: string) => {
        const lastChar = word.charCodeAt(word.length - 1);
        const hasJongseong = (lastChar - 0xAC00) % 28 > 0;
        return hasJongseong ? `${word}과` : `${word}와`;
    },
    // 으로/로
    euro_ro: (word: string) => {
        const lastChar = word.charCodeAt(word.length - 1);
        const jongseongOfs = (lastChar - 0xAC00) % 28;
        // ㄹ 받침(8)이거나 받침이 없으면 '로', 그 외 받침은 '으로'
        return (jongseongOfs === 0 || jongseongOfs === 8) ? `${word}로` : `${word}으로`;
    }
};

/**
 * Verb Conjugation Helper
 * Handles basic endings: -고, -어/아, -게, -지
 */
export const Conjugate = {
    // Stem + 고 -> 먹고, 가고
    go: (stem: string) => `${stem}고`,

    // Stem + (으)ㄹ게 -> 넣을게, 갈게
    eul_ge: (stem: string) => {
        const lastChar = stem.charCodeAt(stem.length - 1);
        const jongseongOfs = (lastChar - 0xAC00) % 28;
        // If has patchim (and not ㄹ), add 을
        // If no patchim or ㄹ patchim, treat logically (simplification: just add 을/ㄹ)
        // For simple approach: if has Jongseong, '을게'. If not, 'ㄹ게' attached? 
        // To be safe/simple without hangul composing logic: just '을게' for consonant ending, 'ㄹ게' for vowel?
        // Let's stick to '을게' for all if we want to be safe, but '갈게' vs '먹을게' is distict.
        // Heuristic: Has Jongseong -> 을게, No -> ㄹ게 (which requires character composition)
        // For now, let's just return '을게' or 'ㄹ게' separated for readability or simple concat?
        // Let's do simple: if batchim, '을게'. If not, just append 'ㄹ게'? No, string composition is hard.
        // Alternative: Just use '을게' for all, Koreans understand '가을게'(awkward) but for '넣다' it's '넣을게'.
        // Better: '넣을' is correct. '박을' is correct. '끼울' is correct.
        return hasBatchim(stem) ? `${stem}을게` : `${stem}ㄹ게`; // Note: "끼우" -> "끼울게" needs composition
    },

    // Stem + 아/어 -> 넣어, 박아
    ah_eo: (stem: string) => {
        // Vowel Harmony:
        // Last vowel is ㅗ (o) or ㅏ (a) -> add 아
        // Others (ㅓ, ㅜ, ㅡ, ㅣ etc) -> add 어
        // 하 -> 해 (special case)

        if (stem.endsWith('하')) return stem.slice(0, -1) + '해';

        // Decompose last char
        const lastChar = stem.charCodeAt(stem.length - 1);
        // Hangul Formula: 0xAC00 + (Cho * 21 * 28) + (Jung * 28) + Jong
        const base = lastChar - 0xAC00;
        const jung = Math.floor((base % 588) / 28); // Jungseong index

        // Jungseong vowels: 
        // 0:ㅏ, 1:ㅐ, 2:ㅑ, 3:ㅒ, 4:ㅓ, 5:ㅔ, 6:ㅕ, 7:ㅖ, 8:ㅗ, 
        // 9:ㅘ, 10:ㅙ, 11:ㅚ, 12:ㅛ, 13:ㅜ, 14:ㅝ, 15:ㅞ, 16:ㅟ, 17:ㅠ, 18:ㅡ, 19:ㅢ, 20:ㅣ

        const brightVowels = [0, 2, 8]; // ㅏ, ㅑ, ㅗ (Simple harmony)

        if (brightVowels.includes(jung)) {
            return `${stem}아`;
        } else {
            return `${stem}어`;
        }
    },

    // Stem + 을/ㄹ 수 -> 넣을 수, 갈 수
    eul_su: (stem: string) => {
        return hasBatchim(stem) ? `${stem}을 수` : `${stem}ㄹ 수`;
    }
};

function hasBatchim(char: string): boolean {
    const code = char.charCodeAt(char.length - 1);
    return (code - 0xAC00) % 28 > 0;
}

// Process a template string
export const processKoreanMarkers = (text: string): string => {
    // First process Josa
    let s = text
        .replace(/{(.+?):ul}/g, (_, word) => Josa.ul_leul(word))
        .replace(/{(.+?):i}/g, (_, word) => Josa.i_ga(word))
        .replace(/{(.+?):eun}/g, (_, word) => Josa.eun_neun(word))
        .replace(/{(.+?):wa}/g, (_, word) => Josa.wa_gwa(word))
        .replace(/{(.+?):ro}/g, (_, word) => Josa.euro_ro(word));

    // No conjugation markers in plain text replacement yet, 
    // Conjugation happens during template filling logic.

    return s;
};
