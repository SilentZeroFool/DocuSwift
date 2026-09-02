const fs = require('fs');
let content = fs.readFileSync('src/components/FileManager.tsx', 'utf-8');

const anchor = `                <input 
                  type="range" 
                  min="50" max="1000" step="50" 
                  value={settings.animationDuration} 
                  onChange={(e) => updateSetting('animationDuration', Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>`;

const addition = `
              
              <div>
                <label className="flex items-center justify-between text-sm font-semibold mb-2">
                  <span>Panning Speed</span>
                  <span className="text-blue-600 font-mono text-xs">{settings.panningSpeed.toFixed(1)}x</span>
                </label>
                <input 
                  type="range" 
                  min="0.1" max="3.0" step="0.1" 
                  value={settings.panningSpeed} 
                  onChange={(e) => updateSetting('panningSpeed', Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>`;

content = content.replace(anchor, anchor + addition);
fs.writeFileSync('src/components/FileManager.tsx', content);
