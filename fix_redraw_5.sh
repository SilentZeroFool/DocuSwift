sed -i '502,510c\
\
  useEffect(() => {\
    redrawStaticAnnotations();\
    redrawActiveStroke();\
  }, [annotations, redrawStaticAnnotations, redrawActiveStroke]);\
' src/components/PdfViewer.tsx
