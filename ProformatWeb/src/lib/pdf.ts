import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface ImportedPage { dataUrl: string; pageSize: 'A4' | 'A5' }

// A5 (148 × 210 mm) a un rapport proche de A4 : on le distingue par la taille réelle de la page
const guessPageSize = (widthPt: number): 'A4' | 'A5' => (widthPt < 500 ? 'A5' : 'A4');

const canvasToDataUrl = (canvas: HTMLCanvasElement) => canvas.toDataURL('image/jpeg', 0.85);

// Convertit la première page d'un PDF en image de fond (≈ 150 dpi)
export const pdfToImage = async (file: File): Promise<ImportedPage> => {
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 1240 / base.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Rendu du PDF impossible.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return { dataUrl: canvasToDataUrl(canvas), pageSize: guessPageSize(base.width) };
};

// Image (PNG, JPEG, WebP) redimensionnée sur fond blanc
export const imageToPage = (file: File): Promise<ImportedPage> => new Promise((resolve, reject) => {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    reject(new Error('Formats acceptés : PDF, PNG, JPEG ou WebP.'));
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible.')); };
  img.onload = () => {
    const scale = Math.min(1, 1240 / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const context = canvas.getContext('2d');
    if (!context) { reject(new Error('Image illisible.')); return; }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    resolve({ dataUrl: canvasToDataUrl(canvas), pageSize: 'A4' });
  };
  img.src = url;
});

export const importTemplateFile = (file: File) => (file.type === 'application/pdf' ? pdfToImage(file) : imageToPage(file));
