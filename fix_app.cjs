const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const handleOpenStart = code.indexOf('  const handleOpenFile = async (doc: LocalDocument) => {');
const handleOpenEnd = code.indexOf('  useEffect(() => {', handleOpenStart);

if (handleOpenStart > -1 && handleOpenEnd > -1) {
    code = code.substring(0, handleOpenStart) + code.substring(handleOpenEnd);
}

// Fix the div mess
const badDiv = `{!isMounted ? <div className="h-screen w-full bg-white dark:bg-gray-900" /> : <div className="h-screen w-full font-sans antialiased animate-in fade-in duration-500 bg-white dark:bg-gray-900 sepia:bg-sepia-50 text-gray-900 dark:text-gray-100 sepia:text-sepia-900 flex flex-col"> bg-white dark:bg-gray-900 sepia:bg-sepia-50 text-gray-900 dark:text-gray-100 sepia:text-sepia-900 flex flex-col">`;
const goodDiv = `{!isMounted ? <div className="h-screen w-full bg-white dark:bg-gray-900 sepia:bg-sepia-50" /> : <div className="h-screen w-full font-sans antialiased animate-in fade-in duration-500 bg-white dark:bg-gray-900 sepia:bg-sepia-50 text-gray-900 dark:text-gray-100 sepia:text-sepia-900 flex flex-col">`;

code = code.replace(badDiv, goodDiv);

fs.writeFileSync('src/App.tsx', code);
console.log("Fixed!");
