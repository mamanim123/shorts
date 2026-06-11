import { generateBenchmarkStorylinePackage } from '../geminiService';
import type { V4FlowInput, V4Storyline } from './v4Types';

export const buildV4ConditionedTopic = (input: Pick<V4FlowInput, 'topic' | 'genre' | 'targetAge' | 'gender'>): string => {
  return [
    input.topic.trim(),
    `장르: ${input.genre}`,
    `타겟 연령: ${input.targetAge}`,
    `주인공 성별: ${input.gender === 'female' ? '여성' : '남성'}`,
    'V4 요구: 쇼츠용 대본으로 확장하기 좋은 줄거리, 장면별 이미지화가 쉬운 행동/소품/장소 포함'
  ].filter(Boolean).join('\n');
};

export const generateV4Storylines = async (input: V4FlowInput): Promise<V4Storyline[]> => {
  const packageResult = await generateBenchmarkStorylinePackage(
    buildV4ConditionedTopic(input),
    input.benchmarkSource?.trim() || undefined
  );

  return packageResult.storylines.map((story) => ({
    title: story.title || '제목 없음',
    content: story.content || '',
    hook: story.hook,
    twist: story.twist
  }));
};

export const generateV4StorylinePackage = async (input: V4FlowInput) => {
  return generateBenchmarkStorylinePackage(
    buildV4ConditionedTopic(input),
    input.benchmarkSource?.trim() || undefined
  );
};

export const resolveV4StoryContext = async (input: V4FlowInput): Promise<{
  selectedStory?: V4Storyline;
  storyContext: string;
}> => {
  if (input.selectedStoryContext?.trim()) {
    return { storyContext: input.selectedStoryContext.trim() };
  }

  const storylines = await generateV4Storylines(input);
  const selectedStory = storylines[0];
  if (!selectedStory) {
    return { storyContext: '' };
  }

  return {
    selectedStory,
    storyContext: `${selectedStory.title}\n${selectedStory.content}`.trim()
  };
};
