const fs = require('fs');
let content = fs.readFileSync('src/components/PdfViewer.tsx', 'utf8');

const search = `      // Reload fresh PDF bytes
      const loadingTask = pdfjsLib.getDocument({ data: savedBytes.slice(0) });
      const loadedPdf = await loadingTask.promise;
      setPdf(loadedPdf);
    } catch (e) {
      console.error('Error saving PDF:', e);
      showToast("Error saving annotations: " + (e instanceof Error ? e.message : String(e)));
    } finally {`;

const replace = `      // Reload fresh PDF bytes
      const loadingTask = pdfjsLib.getDocument({ data: savedBytes.slice(0) });
      const loadedPdf = await loadingTask.promise;
      setPdf(loadedPdf);
    } catch (e) {
      console.error('Error saving PDF:', e);
      alert("Error saving annotations: " + (e instanceof Error ? e.message : String(e)));
      showToast("Error saving annotations: " + (e instanceof Error ? e.message : String(e)));
    } finally {`;

content = content.replace(search, replace);
fs.writeFileSync('src/components/PdfViewer.tsx', content);
