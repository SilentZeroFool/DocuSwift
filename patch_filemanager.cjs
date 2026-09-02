const fs = require('fs');
let code = fs.readFileSync('src/components/FileManager.tsx', 'utf-8');

const oldLogout = `<LogOut className="w-4 h-4" />
                      Logout ({user.email})
                    </button>`;

const newLogout = `<LogOut className="w-4 h-4" />
                      Logout ({user.displayName || user.email || 'User'})
                    </button>`;

code = code.replace(oldLogout, newLogout);
fs.writeFileSync('src/components/FileManager.tsx', code);
