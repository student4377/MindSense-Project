export type MindSensePreferences = {
  darkMode: boolean;
  assistantMemory: boolean;
  moodDrafts: boolean;
};

export const MINDSENSE_SETTINGS_KEY = "mindsense-settings-v1";

export const DEFAULT_MINDSENSE_PREFERENCES: MindSensePreferences = {
  darkMode: true,
  assistantMemory: true,
  moodDrafts: true,
};

export const readMindSensePreferences = (): MindSensePreferences => {
  try {
    const saved = localStorage.getItem(MINDSENSE_SETTINGS_KEY);
    if (!saved) return DEFAULT_MINDSENSE_PREFERENCES;
    return { ...DEFAULT_MINDSENSE_PREFERENCES, ...JSON.parse(saved) };
  } catch {
    localStorage.removeItem(MINDSENSE_SETTINGS_KEY);
    return DEFAULT_MINDSENSE_PREFERENCES;
  }
};

export const saveMindSensePreferences = (preferences: MindSensePreferences) => {
  localStorage.setItem(MINDSENSE_SETTINGS_KEY, JSON.stringify(preferences));
};

export const applyMindSensePreferences = (preferences = readMindSensePreferences()) => {
  document.documentElement.classList.toggle("dark", preferences.darkMode);
};
