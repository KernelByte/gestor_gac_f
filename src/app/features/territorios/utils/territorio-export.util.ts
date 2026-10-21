// html2canvas y jspdf se cargan bajo demanda: exportar una tarjeta es una
// accion ocasional y entre las dos librerias suman cientos de kB que antes
// entraban en el chunk de territorios para todo el que abria la pantalla.

export function exportTerritorioCard(
  elementId: string,
  codigo: string,
  format: 'pdf' | 'image' = 'pdf'
): Promise<void> {
  // La tarjeta sigue sin propagar el error: quien la llama no lo maneja.
  return exportarElemento(elementId, `Tarjeta_${codigo}`, format).catch(() => undefined);
}

/** Exporta un elemento de la página a PNG o PDF con el nombre de archivo dado (sin extensión). */
export async function exportarElemento(
  elementId: string,
  nombreArchivo: string,
  format: 'pdf' | 'image' = 'pdf'
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element #${elementId} not found`);
    return;
  }

  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    if (format === 'image') {
      const link = document.createElement('a');
      link.download = `${nombreArchivo}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else {
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // A4-ish landscape ratio
      const pdfWidth = 210;
      const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${nombreArchivo}.pdf`);
    }
  } catch (err) {
    console.error('Error exporting card:', err);
    throw err;
  }
}
