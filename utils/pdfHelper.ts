import * as pdfjsLib from 'pdfjs-dist';

// Fix for loading issues with PDF.js in browser environments via ESM
// We need to handle the default export behavior of different bundlers/CDNs
const pdf = (pdfjsLib as any).default || pdfjsLib;

// Configure the worker to use the classic script from cdnjs
// This avoids issues with ES module workers (.mjs) and CORS restrictions on some CDNs
// We must ensure the version matches the main library (3.11.174)
if (pdf && pdf.GlobalWorkerOptions) {
  pdf.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export const extractTextFromPdf = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Use the resolved pdf object to call getDocument
    const loadingTask = pdf.getDocument({ data: arrayBuffer });
    const doc = await loadingTask.promise;
    
    let fullText = '';
    const totalPages = doc.numPages;

    // Iterate through all pages to extract text
    for (let i = 1; i <= totalPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      // @ts-ignore
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      
      fullText += `\n--- Page ${i} ---\n${pageText}`;
    }
    
    return fullText;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to extract text from PDF. The file might be corrupted or encrypted.');
  }
};