export const normalizeTopicText = (value?: string | null): string => {
  if (!value) return '';
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

export const isTopicDirectlyCopied = (
  script?: string | null,
  topic?: string | null
): boolean => {
  if (!script || !topic) return false;
  const normalizedTopic = normalizeTopicText(topic);
  if (normalizedTopic.length < 4) return false;
  const normalizedScript = normalizeTopicText(script);
  return normalizedScript.includes(normalizedTopic);
};

export const buildTopicViolationNotice = (topic: string, attempt: number): string => {
  const trimmed = topic.trim();
  const topicLabel = trimmed.length > 0 ? trimmed : 'the provided topic';
  return (
    `🚨🚨🚨 [TOPIC VARIATION FAILURE - ATTEMPT ${attempt}] 🚨🚨🚨\n` +
    `You repeated the topic phrase "${topicLabel}" verbatim. ` +
    'Rewrite the ENTIRE script using fresh wording, metaphors, and contextual descriptions.\n' +
    '- Describe the scenario using sensory details instead of quoting the topic.\n' +
    '- Introduce at least two new nouns or verbs that never appear in the topic text.\n' +
    '- If the topic contains proper nouns, replace them with descriptive substitutes.\n' +
    'Return a brand new script immediately.'
  );
};
