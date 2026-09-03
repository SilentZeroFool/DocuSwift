const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
const oldEnd = `      </div>
      )}
    </SettingsProvider>
    </ThemeProvider>
  );
}`;
const newEnd = `      </div>
      )}
    </SettingsProvider>
    </ThemeProvider>
  );
}`;
code = code.replace(oldEnd, `      </div>\n      }\n    </SettingsProvider>\n    </ThemeProvider>\n  );\n}`);
fs.writeFileSync('src/App.tsx', code);
