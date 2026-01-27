import { jsonrepair } from 'jsonrepair';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const extractValidJson = (text: string): string | null => {
  if (!text) return null;
  let startIndex = -1;
  let startChar = '';
  let endChar = '';
  let depth = 0;
  let inString = false;
  let escaped = false;
  let lastStart = -1;
  let lastEnd = -1;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (ch === '\\' && !escaped) {
      escaped = true;
      continue;
    }

    if (ch === '"' && !escaped) {
      inString = !inString;
    }
    escaped = false;

    if (inString) continue;

    if (startIndex === -1 && (ch === '{' || ch === '[')) {
      startIndex = i;
      startChar = ch;
      endChar = ch === '{' ? '}' : ']';
      depth = 1;
      continue;
    }

    if (startIndex !== -1) {
      if (ch === startChar) depth += 1;
      if (ch === endChar) depth -= 1;
      if (depth === 0) {
        lastStart = startIndex;
        lastEnd = i + 1;
        startIndex = -1;
        startChar = '';
        endChar = '';
      }
    }
  }

  if (lastStart !== -1 && lastEnd !== -1) {
    return text.substring(lastStart, lastEnd);
  }
  return null;
};

export const escapeInlineQuotesForKeys = (text: string, keys: string[]): string => {
  if (!text || keys.length === 0) return text;

  const keyPattern = keys.map(escapeRegex).join('|');
  const regex = new RegExp('"(' + keyPattern + ')"\\s*:\\s*"', 'g');
  let result = '';
  let lastIndex = 0;

  while (true) {
    const match = regex.exec(text);
    if (!match) break;

    const valueStart = regex.lastIndex;
    result += text.slice(lastIndex, valueStart);

    let j = valueStart;
    let escaped = false;
    let chunk = '';

    while (j < text.length) {
      const ch = text[j];

    if (ch === '\\' && !escaped) {
        escaped = true;
        chunk += ch;
        j += 1;
        continue;
      }

      if (ch === '"' && !escaped) {
        let k = j + 1;
        while (k < text.length && /\s/.test(text[k])) k += 1;
        if (k >= text.length || /[,\]}]/.test(text[k])) {
          break;
        }
        chunk += '\\"';
        j += 1;
        continue;
      }

      escaped = false;
      chunk += ch;
      j += 1;
    }

    result += chunk;
    if (j < text.length && text[j] === '"') {
      result += '"';
      j += 1;
    }

    lastIndex = j;
    regex.lastIndex = j;
  }

  result += text.slice(lastIndex);
  return result;
};

export const preprocessJson = (str: string): string => {
  const escapeInternalQuotes = (input: string): string => {
    let result = '';
    let inString = false;
    let escaped = false;

    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];

      if (!inString) {
        if (ch === '"') inString = true;
        result += ch;
        continue;
      }

      if (escaped) {
        result += ch;
        escaped = false;
        continue;
      }

      if (ch === '\\') {
        result += ch;
        escaped = true;
        continue;
      }

      if (ch === '"') {
        let j = i + 1;
        while (j < input.length && /\s/.test(input[j])) j += 1;
        const next = input[j];

        if (next === undefined || next === ',' || next === '}' || next === ']' || next === ':') {
          inString = false;
          result += ch;
          continue;
        }

        result += '\\"';
        continue;
      }

      result += ch;
    }

    return result;
  };

  return escapeInternalQuotes(str)
    .replace(/([가-힣]\s*)"([가-힣])/g, '$1\\"$2')
    .replace(/([가-힣])"(\s*")/g, '$1\\"$2')
    .replace(/([가-힣])"([가-힣])/g, '$1\\"$2');
};

export const parseJsonFromText = <T = any>(text: string, keys: string[] = []): T | null => {
  if (!text) return null;
  let jsonText = text.replace(/```json/gi, '').replace(/```/g, '');

  const extracted = extractValidJson(jsonText);
  if (extracted) {
    jsonText = extracted;
  }

  jsonText = escapeInlineQuotesForKeys(jsonText, keys);

  try {
    return JSON.parse(jsonText) as T;
  } catch (error) {
    console.debug('[jsonParse] JSON.parse failed', error);
    try {
      const preprocessed = preprocessJson(jsonText);
      return JSON.parse(preprocessed) as T;
    } catch (error2) {
      console.debug('[jsonParse] preprocessJson parse failed', error2);
      try {
        const repaired = jsonrepair(jsonText);
        return JSON.parse(repaired) as T;
      } catch (error3) {
        console.debug('[jsonParse] jsonrepair failed', error3);
        try {
          const preprocessed = preprocessJson(jsonText);
          const repaired = jsonrepair(preprocessed);
          return JSON.parse(repaired) as T;
        } catch (error4) {
          console.debug('[jsonParse] preprocess+jsonrepair failed', error4);
          return null;
        }
      }
    }
  }
};
