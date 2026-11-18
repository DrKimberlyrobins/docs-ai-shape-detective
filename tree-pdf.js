'use strict';

window.createTrainedTreePdf = async diagram => {
  const margin = 35;
  const top = 100;
  const fit = (width, height) => Math.min(
    (width - 2 * margin) / diagram.width,
    (height - top - margin) / diagram.height
  );
  const landscape = fit(792, 612) > fit(612, 792);
  const [width, height] = landscape ? [792, 612] : [612, 792];
  const factor = fit(width, height);
  const diagramWidth = diagram.width * factor;
  const diagramHeight = diagram.height * factor;

  const url = URL.createObjectURL(new Blob([diagram.markup], { type: 'image/svg+xml;charset=utf-8' }));
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(diagramWidth * 3);
    canvas.height = Math.ceil(diagramHeight * 3);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const pdf = await PDFDocument.create();
    pdf.setTitle('Shape Detective - Trained Decision Tree');
    const page = pdf.addPage([width, height]);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const color = rgb(0.09, 0.08, 0.19);
    page.drawText("DOC'S AI SHAPE DETECTIVE", { x: margin, y: height - 39, font: bold, size: 10, color });
    page.drawText('Trained decision tree', { x: margin, y: height - 63, font: bold, size: 22, color });
    page.drawText('Group: ____________________________      Date: _______________',
      { x: margin, y: height - 83, font: regular, size: 10, color });
    const png = await pdf.embedPng(canvas.toDataURL('image/png'));
    page.drawImage(png, {
      x: (width - diagramWidth) / 2, y: height - top - diagramHeight,
      width: diagramWidth, height: diagramHeight
    });
    return pdf.save();
  } finally {
    URL.revokeObjectURL(url);
  }
};
