// ============================================================
// [신규] 줄거리 패키지 생성 (신버전에서 이식)
// ============================================================

export interface BenchmarkAnalysisSummary {
  sourceSummary: string;
  hookPattern: string;
  narrativeStructure: string;
  toneStyle: string;
  narrationHabit: string;
  rebuildProtocol: string;
}

export interface StorylineItem {
  title: string;
  content: string;
}

export interface BenchmarkStorylinePackage {
  analysis: BenchmarkAnalysisSummary | null;
  storylines: StorylineItem[];
}

export const generateBenchmarkStorylinePackage = async (
  topic: string,
  count: number = 10,
  benchmarkText?: string,
): Promise<BenchmarkStorylinePackage> => {
  const normalizedTopic = (topic || '').trim();
  const normalizedBenchmark = (benchmarkText || '').trim();

  const prompt = normalizedBenchmark
    ? `You are a Korean YouTube Shorts strategist.

[USER TARGET TOPIC]
${normalizedTopic || '일반 주제'}

[BENCHMARK MATERIAL]
${normalizedBenchmark}

Analyze the benchmark material and return a JSON object.
Return ONLY valid JSON:
{
  "analysis": {
    "sourceSummary": "원본 핵심 요약",
    "hookPattern": "후킹 방식",
    "narrativeStructure": "전개 구조",
    "toneStyle": "톤/말투",
    "narrationHabit": "나레이션 습관",
    "rebuildProtocol": "재구성 규칙"
  },
  "storylines": [
    { "title": "클릭을 부르는 제목", "content": "줄거리 1-2문장" }
  ]
}
Rules: Output 100% Korean. Do not copy specific lines. Return exactly ${count} storylines.`
    : `You are a viral YouTube Shorts content planner.
Topic: "${normalizedTopic}"
Generate ${count} highly engaging Korean storyline ideas.
Return ONLY valid JSON:
{
  "storylines": [
    { "title": "클릭을 부르는 제목", "content": "줄거리 1-2문장" }
  ]
}
Rules: Output 100% Korean. Return exactly ${count} items.`;

  try {
    const response = await fetch('http://localhost:3002/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: 'GEMINI',
        prompt,
        responseMode: 'simple-text',
      }),
    });
    const payload = await response.json();
    const text = payload.rawResponse || payload.text || payload.result || '';
    if (!text.trim()) throw new Error('빈 응답');

    let parsed: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    }

    if (!parsed || !Array.isArray(parsed.storylines)) throw new Error('줄거리 파싱 실패');

    return {
      storylines: parsed.storylines
        .filter((s: any) => s?.title && s?.content)
        .slice(0, count),
      analysis: parsed.analysis || null,
    };
  } catch (error: any) {
    console.error('[generateBenchmarkStorylinePackage] Error:', error);
    throw new Error(`줄거리 생성 실패: ${error.message}`);
  }
};
