import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportTerritorioCard(
  elementId: string,
  codigo: string,
  format: 'pdf' | 'image' = 'pdf'
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element #${elementId} not found`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    if (format === 'image') {
      const link = document.createElement('a');
      link.download = `Tarjeta_${codigo}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else {
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // A4-ish landscape ratio
      const pdfWidth = 210;
      const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

      const pdf = new jsPDF({
        orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Tarjeta_${codigo}.pdf`);
    }
  } catch (err) {
    console.error('Error exporting card:', err);
  }
}
