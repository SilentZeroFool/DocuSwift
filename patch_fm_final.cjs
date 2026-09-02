const fs = require('fs');
let content = fs.readFileSync('src/components/FileManager.tsx', 'utf-8');

const old = `                  onChange={(e) => updateSetting('animationDuration', parseInt(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>`;

const addition = `                  onChange={(e) => updateSetting('animationDuration', parseInt(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-sm font-semibold mb-2">
                  <span>Panning Speed</span>
                  <span className="text-blue-600 font-mono text-xs">{settings.panningSpeed.toFixed(1)}x</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">Adjusts how fast the document moves when panning with the tool.</p>
                <input 
                  type="range" 
                  min="0.1" max="3.0" step="0.1" 
                  value={settings.panningSpeed} 
                  onChange={(e) => updateSetting('panningSpeed', parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>`;

content = content.replace(old, addition);
fs.writeFileSync('src/components/FileManager.tsx', content);
