const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  `  const handleLogin = async () => {
    try {
      await googleSignIn();
    } catch (e) {`,
  `  const handleLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
      }
    } catch (e) {`
);

fs.writeFileSync('src/App.tsx', content);
