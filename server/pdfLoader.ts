import fs from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM __dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function loadPenalCodeText(): Promise<string> {
  const pdfParser = new PDFParser();

  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, '../Penal-Code-eng_98975fad025a402e862e883a3aa3d774.pdf');
    console.log("📄 Attempting to load PDF from:", filePath);

    pdfParser.on("pdfParser_dataError", err => {
      console.error("❌ PDF parse error:", err.parserError);
      reject(err.parserError);
    });

    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      if (!pdfData?.formImage?.Pages) {
        console.error("❌ PDF loaded but contains no Pages.");
        return resolve('');
      }

      const text = pdfData.formImage.Pages.map((page: any) =>
        page.Texts.map((t: any) =>
          decodeURIComponent(t.R[0].T)
        ).join(' ')
      ).join('\n\n');

      console.log("✅ PDF text extracted successfully");
      resolve(text || null);
    });

    pdfParser.loadPDF(filePath);
  });
}
