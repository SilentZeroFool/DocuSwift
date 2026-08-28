const fs = require('fs');
let content = fs.readFileSync('src/components/FileManager.tsx', 'utf8');

content = content.replace(
  "} from 'lucide-react';",
  "  Menu, Settings as SettingsIcon, LogOut\n} from 'lucide-react';"
);

content = content.replace(
  "import { useTheme } from './ThemeContext';",
  "import { useTheme } from './ThemeContext';\nimport { useSettings } from './SettingsContext';\nimport { logout } from '../lib/firebase';"
);

content = content.replace(
  "export function FileManager({ onOpenFile, onCompressPDF, onSync, user, onLogin }: FileManagerProps) {",
  `export function FileManager({ onOpenFile, onCompressPDF, onSync, user, onLogin }: FileManagerProps) {
  const { settings, updateSetting, resetSettings } = useSettings();
  const [isBurgerMenuOpen, setIsBurgerMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);`
);

const searchHeader = `        <div className="flex items-center gap-1.5">
          {/* Theme Selector Button */}
          <div className="relative">
            <button 
              id="theme-menu-toggle"
              onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
              className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100 active:scale-95 transition-all text-gray-700 dark:text-gray-300"
              aria-label="Toggle theme menu"
            >
              {theme === 'system' ? <Laptop className="w-5 h-5" /> : theme === 'dark' ? <Moon className="w-5 h-5" /> : theme === 'sepia' ? <Coffee className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>`;

const replaceHeader = `        <div className="flex items-center gap-1.5">
          {/* Burger Menu */}
          <div className="relative">
            <button
              onClick={() => setIsBurgerMenuOpen(!isBurgerMenuOpen)}
              className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100 active:scale-95 transition-all text-gray-700 dark:text-gray-300"
            >
              <Menu className="w-6 h-6" />
            </button>
            {isBurgerMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsBurgerMenuOpen(false)} />
                <div className="absolute right-0 top-12 mt-2 w-56 bg-white dark:bg-gray-800 sepia:bg-sepia-50 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 z-40 overflow-hidden py-1">
                  
                  {/* Theme Toggle (Inline) */}
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                    <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Theme</div>
                    <div className="flex gap-1">
                      {['light', 'dark', 'sepia', 'system'].map((t) => (
                        <button
                          key={t}
                          onClick={() => { setTheme(t as any); setIsBurgerMenuOpen(false); }}
                          className={\`flex-1 p-2 flex items-center justify-center rounded-lg transition-colors \${theme === t ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}\`}
                        >
                          {t === 'light' ? <Sun className="w-4 h-4" /> : t === 'dark' ? <Moon className="w-4 h-4" /> : t === 'sepia' ? <Coffee className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => { setIsBurgerMenuOpen(false); setIsSettingsModalOpen(true); }}
                    className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-gray-700 dark:text-gray-200"
                  >
                    <SettingsIcon className="w-4 h-4" />
                    Advanced Settings
                  </button>

                  <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
                  
                  {user ? (
                    <button
                      onClick={async () => {
                        await logout();
                        setIsBurgerMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout ({user.email})
                    </button>
                  ) : (
                    <button
                      onClick={() => { setIsBurgerMenuOpen(false); onLogin(); }}
                      className="w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors"
                    >
                      <Cloud className="w-4 h-4" />
                      Login with Google
                    </button>
                  )}
                </div>
              </>
            )}
          </div>`;

// Strip out the old theme selector entirely and replace it with the new burger menu!
// First we locate the entire `          {/* Theme Selector Button */}` block up to `        </div>`
content = content.replace(/<div className="flex items-center gap-1.5">[\s\S]*?{user \? \([\s\S]*?<\/div>\n      <\/header>/, replaceHeader + '\n        </div>\n      </header>');


const settingsModalUI = `
      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 sepia:bg-sepia-50 w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold">Advanced Settings</h2>
              <button 
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-5">
              
              <div>
                <label className="flex items-center justify-between text-sm font-semibold mb-2">
                  <span>Zoom Sensitivity</span>
                  <span className="text-blue-600 font-mono text-xs">{settings.zoomSensitivity.toFixed(2)}x</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">Adjusts how fast the document scales when you pinch to zoom.</p>
                <input 
                  type="range" 
                  min="0.1" 
                  max="3.0" 
                  step="0.1" 
                  value={settings.zoomSensitivity}
                  onChange={(e) => updateSetting('zoomSensitivity', parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-sm font-semibold mb-2">
                  <span>Double Tap Speed window</span>
                  <span className="text-blue-600 font-mono text-xs">{settings.doubleTapSpeed}ms</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">Maximum time between taps to register a double-tap zoom.</p>
                <input 
                  type="range" 
                  min="100" 
                  max="800" 
                  step="50" 
                  value={settings.doubleTapSpeed}
                  onChange={(e) => updateSetting('doubleTapSpeed', parseInt(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-sm font-semibold mb-2">
                  <span>Zoom Animation Duration</span>
                  <span className="text-blue-600 font-mono text-xs">{settings.animationDuration}ms</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">How long the double-tap zoom transition takes.</p>
                <input 
                  type="range" 
                  min="0" 
                  max="1000" 
                  step="50" 
                  value={settings.animationDuration}
                  onChange={(e) => updateSetting('animationDuration', parseInt(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
              
              <div className="pt-2">
                <button 
                  onClick={resetSettings}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-sm font-semibold rounded-xl transition-colors"
                >
                  Reset Defaults
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
`;

content = content.replace("    <div className=\"flex flex-col h-full overflow-hidden select-none\">", "    <div className=\"flex flex-col h-full overflow-hidden select-none\">\n" + settingsModalUI);

fs.writeFileSync('src/components/FileManager.tsx', content);
