import React, { createContext, useContext, useState, useEffect } from 'react';

interface Settings {
  zoomSensitivity: number; // e.g. 0.5 to 2.0
  doubleTapSpeed: number; // e.g. 100 to 500 ms
  animationDuration: number; // e.g. 0 to 500 ms
  panningSpeed: number; // e.g. 0.5 to 3.0
}

const defaultSettings: Settings = {
  zoomSensitivity: 1.0,
  doubleTapSpeed: 300,
  animationDuration: 200,
  panningSpeed: 1.0,
};

interface SettingsContextType {
  settings: Settings;
  updateSetting: (key: keyof Settings, value: number) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  updateSetting: () => {},
  resetSettings: () => {},
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('docuswift-settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('docuswift-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (key: keyof Settings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
