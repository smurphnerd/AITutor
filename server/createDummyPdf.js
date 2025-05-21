const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function createDummyPdf() {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Add a blank page
  pdfDoc.addPage([550, 750]);
  
  // Save the PDF document
  const pdfBytes = await pdfDoc.save();
  
  // Ensure directory exists
  if (!fs.existsSync('./test/data')) {
    fs.mkdirSync('./test/data', { recursive: true });
  }
  
  // Write to file
  fs.writeFileSync('./test/data/05-versions-space.pdf', pdfBytes);
  
  console.log('Created dummy PDF file for pdf-parse tests');
}

createDummyPdf().catch(error => {
  console.error('Error creating dummy PDF:', error);
});