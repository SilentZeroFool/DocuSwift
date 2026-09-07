sed -i "s/root.classList.remove('light', 'dark', 'sepia');/root.classList.remove('light', 'dark', 'theme-sepia');/g" src/components/ThemeContext.tsx
sed -i "s/root.classList.add(theme);/root.classList.add(theme === 'sepia' ? 'theme-sepia' : theme);/g" src/components/ThemeContext.tsx
