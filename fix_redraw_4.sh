# Determine lines to replace
START=$(cat -n src/components/PdfViewer.tsx | grep -n "const redrawActiveStroke = useCallback" | cut -d: -f1 | head -n 1)
START_LINE=$(sed -n "${START}p" <(cat -n src/components/PdfViewer.tsx) | awk '{print $1}')
END=$(cat -n src/components/PdfViewer.tsx | grep -n "});" | awk -F: '$1 > '"$START"' {print $1}' | head -n 1)
END_LINE=$(sed -n "${END}p" <(cat -n src/components/PdfViewer.tsx) | awk '{print $1}')
sed -i "${START_LINE},${END_LINE}d" src/components/PdfViewer.tsx
sed -i "${START_LINE}r replacement.txt" src/components/PdfViewer.tsx
