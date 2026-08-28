const fs = require('fs');
const path = './src/components/FileManager.tsx';
let content = fs.readFileSync(path, 'utf8');
const search = `                  <div className="font-semibold">Open & Read</div>
                  <div className="text-xs text-gray-500">View pages with smooth zooming & annotation</div>
                </div>
              </button>`;
const replace = search + `

              {user && (
                <button 
                  onClick={() => {
                    setActiveMenuDoc(null);
                    onSync();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl text-left font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 sepia:hover:bg-sepia-100 active:bg-gray-100 dark:active:bg-gray-700 transition-colors text-gray-900 dark:text-gray-100"
                >
                  <div className="p-2 rounded-xl bg-green-50 text-green-600 dark:bg-green-900/30">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold">Backup to Drive</div>
                    <div className="text-xs text-gray-500">Securely sync this document</div>
                  </div>
                </button>
              )}`;
content = content.replace(search, replace);
fs.writeFileSync(path, content);
