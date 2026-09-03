const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');
const script = `  <style>
    body { margin: 0; background-color: #ffffff; }
    @media (prefers-color-scheme: dark) {
      body { background-color: #111827; }
    }
  </style>
  <script>
    // Apply local storage theme immediately before React boots
    try {
      const theme = localStorage.getItem('docuswift_theme');
      if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        document.body.style.backgroundColor = '#111827';
      } else if (theme === 'sepia') {
        document.documentElement.classList.add('sepia');
        document.body.style.backgroundColor = '#f4ecd8';
      } else {
        document.body.style.backgroundColor = '#ffffff';
      }
    } catch(e) {}
  </script>
</head>`;
html = html.replace('</head>', script);
fs.writeFileSync('index.html', html);
