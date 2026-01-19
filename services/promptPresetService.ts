import { PromptPresetSummary, PromptPreset } from '../types';

const API_BASE = 'http://localhost:3002';

export async function fetchPromptPresets(): Promise<PromptPresetSummary[]> {
  try {
    const res = await fetch(`${API_BASE}/api/prompt-presets`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[PromptPreset] Failed to load presets:', error);
    return [];
  }
}

export async function fetchPromptPresetDetail(id: string): Promise<PromptPreset | null> {
  if (!id) return null;
  try {
    const res = await fetch(`${API_BASE}/api/prompt-presets/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error(`[PromptPreset] Failed to load preset ${id}:`, error);
    return null;
  }
}

interface PromptPresetPayload {
  id?: string;
  name: string;
  description?: string;
  content: string;
}

export async function createPromptPreset(payload: PromptPresetPayload): Promise<PromptPreset | null> {
  try {
    const res = await fetch(`${API_BASE}/api/prompt-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('[PromptPreset] Failed to create preset:', error);
    return null;
  }
}

export async function updatePromptPreset(id: string, payload: PromptPresetPayload): Promise<PromptPreset | null> {
  try {
    const res = await fetch(`${API_BASE}/api/prompt-presets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('[PromptPreset] Failed to update preset:', error);
    return null;
  }
}

export async function deletePromptPreset(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/prompt-presets/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } catch (error) {
    console.error('[PromptPreset] Failed to delete preset:', error);
    return false;
  }
}
