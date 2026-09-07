sed -i "s/@custom-variant sepia (&:where(.sepia, .sepia \*));/@custom-variant sepia (\&:where(.theme-sepia, .theme-sepia \*));/g" src/index.css
sed -i "s/html.sepia {/html.theme-sepia {/g" src/index.css
sed -i "s/html.sepia body {/html.theme-sepia body {/g" src/index.css
