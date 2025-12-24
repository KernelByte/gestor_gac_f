import { Injectable } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface ReportTemplateData {
   groupName: string;
   captainName: string;
   assistantName?: string;
   period: string; // e.g., "SEPTIEMBRE 2025"
   publishers: {
      id: number;
      name: string;
      precursorType?: string; // For pre-filling if needed, though usually blank in template
   }[];
   congregationId: number;
   groupId: number;
}

@Injectable({
   providedIn: 'root'
})
export class ExcelService {

   constructor() { }

   async generateInformeTemplate(data: ReportTemplateData) {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Informe', {
         views: [{ showGridLines: true }]
      });

      // --- Colores ---
      const headerBlue = 'FF2E4496'; // Azul oscuro similar a la imagen (RGB aprox 46, 68, 150)
      const headerLightBlue = 'FFDCE6F1'; // Azul claro para nombres
      const tableHeaderGreen = 'FF5FA838'; // Verde similar a la imagen
      const rowGrey = 'FFF2F2F2'; // Gris muy claro alternado (opcional)

      // --- Definir Columnas ---
      // A: Padding, B: Nombre, C: ¿Predicó?, D: Precursurado, E: Horas, F: Cursos, G: Observaciones
      // H, I, J: Ocultas (IDs)
      worksheet.columns = [
         { key: 'pad', width: 2 },
         { key: 'name', width: 35 },     // B: Nombre
         { key: 'predico', width: 12 },  // C: ¿Predicó?
         { key: 'precursor', width: 20 },// D: Precursurado
         { key: 'horas', width: 10 },    // E: Horas
         { key: 'cursos', width: 15 },   // F: Cursos
         { key: 'obs', width: 40 },      // G: Observaciones
         { key: 'id_pub', width: 0, hidden: true },   // H: ID Publicador
         { key: 'id_grp', width: 0, hidden: true },   // I: ID Grupo
         { key: 'id_cong', width: 0, hidden: true },  // J: ID Cong
      ];

      // --- Encabezado Superior (Grupo) ---
      // Fila 1: Título Grupo (Merged B-G)
      worksheet.mergeCells('B1:H1');
      const titleCell = worksheet.getCell('B1');
      titleCell.value = data.groupName.toUpperCase();
      titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBlue } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 25;

      // Fila 2: Etiquetas Capitán / Auxiliar
      const labelStyle: Partial<ExcelJS.Style> = {
         font: { bold: true, size: 10 },
         alignment: { horizontal: 'center', vertical: 'middle' },
         fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: headerLightBlue } }
      };

      worksheet.mergeCells('B2:D2');
      worksheet.getCell('B2').value = 'Capitán de grupo';
      worksheet.getCell('B2').style = labelStyle;

      worksheet.mergeCells('E2:F2');
      worksheet.getCell('E2').value = 'Auxiliar de Grupo';
      worksheet.getCell('E2').style = labelStyle;

      // Fila 3: Nombres
      worksheet.mergeCells('B3:D3');
      worksheet.getCell('B3').value = data.captainName;
      worksheet.getCell('B3').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('B3').border = { bottom: { style: 'thin' } };

      worksheet.mergeCells('E3:F3');
      worksheet.getCell('E3').value = data.assistantName || '-';
      worksheet.getCell('E3').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('E3').border = { bottom: { style: 'thin' } };

      // Bloque Periodo (G2:H3) - H is hidden but maybe visible in Excel if user unhides? 
      // Actually relying on H for visible content is bad/confusing if H is hidden ID.
      // Let's assume the "Periodo" needs to be in G mostly or we use a separate column for ID later (like Z).
      // Let's move hidden columns to Z, AA, AB to avoid messing up layout.
      // Re-defining columns to be safe.
      worksheet.spliceColumns(8, 3); // Remove data columns from H

      // Period box
      worksheet.mergeCells('G2:G3');
      const periodCell = worksheet.getCell('G2');
      periodCell.value = data.period;
      periodCell.font = { size: 14, bold: true };
      periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
      periodCell.border = { top: { style: 'medium', color: { argb: headerBlue } }, bottom: { style: 'medium', color: { argb: headerBlue } }, left: { style: 'medium', color: { argb: headerBlue } }, right: { style: 'medium', color: { argb: headerBlue } } };


      // --- Tabla de Datos ---
      const startRow = 5;
      const headerRow = worksheet.getRow(startRow);
      headerRow.values = [
         null, // A
         'Nombre', // B
         '¿Predicó?', // C
         'Precursurado', // D
         'Horas', // E
         'Cursos Bíblicos', // F
         'Observaciones' // G
      ];

      headerRow.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
         if (colNumber > 1 && colNumber <= 7) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tableHeaderGreen } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
         }
      });

      // --- Filas de Publicadores ---
      data.publishers.forEach((pub, index) => {
         const rowIndex = startRow + 1 + index;
         const row = worksheet.getRow(rowIndex);

         // Values
         row.getCell(2).value = pub.name; // B
         row.getCell(3).value = 'Si'; // Default C (¿Predicó?) match image showing 'Si' or blank? Image shows 'Si' mostly. Let's leave blank or default 'Si'?
         // Actually image shows existing data. For template, maybe blank or pre-fill "Si" if active? 
         // User said "Esta plantilla una vez la llene el usuario...".
         // Usually better to leave Predico/Hours blank for user to fill.
         // But maybe "Si" is a good default? Let's leave blank for now, or "Si". 
         // Image has "Si" for everyone. Let's put "Si" as value but user can change.
         row.getCell(3).value = 'Si';

         row.getCell(4).value = pub.precursorType; // D

         row.getCell(5).value = 0; // E: Horas default
         row.getCell(6).value = 0; // F: Cursos default
         row.getCell(7).value = ''; // G: Obs

         // Hidden IDs (Col Z, AA, AB) -> Column 26, 27, 28
         row.getCell(26).value = pub.id;
         row.getCell(27).value = data.groupId;
         row.getCell(28).value = data.congregationId;
         // Ensure these columns are hidden
         worksheet.getColumn(26).hidden = true;
         worksheet.getColumn(27).hidden = true;
         worksheet.getColumn(28).hidden = true;

         // Styling
         row.getCell(2).border = { left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
         row.getCell(3).border = { left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
         row.getCell(4).border = { left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
         row.getCell(5).border = { left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
         row.getCell(6).border = { left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
         row.getCell(7).border = { left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };

         row.getCell(3).alignment = { horizontal: 'center' }; // Predicó
         row.getCell(5).alignment = { horizontal: 'center' }; // Horas
         row.getCell(6).alignment = { horizontal: 'center' }; // Cursos

         // Zebra striping (optional, visual polish)
         if (index % 2 === 1) {
            // row.eachCell((c) => c.fill = rowGrey... );
         }

         // --- Data Validation ---
         // ¿Predicó? (Col C)
         row.getCell(3).dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: ['"Si,No"'],
            showErrorMessage: true,
            errorStyle: 'stop',
            errorTitle: 'Valor inválido',
            error: 'Seleccione Si o No'
         };

         // Precursurado (Col D)
         row.getCell(4).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"Precursor Regular,Precursor Auxiliar,Precursor Especial"'],
            showErrorMessage: true,
            errorStyle: 'warning', // Warning allow typing if list incomplete? No, stick to stop usually.
            error: 'Seleccione un tipo válido'
         };

         // Unlock editable cells
         // Protect sheet but unlock specific cells
         // Default is locked. We unlock input cells.
         row.getCell(3).protection = { locked: false }; // Predico
         row.getCell(4).protection = { locked: false }; // Precursor
         row.getCell(5).protection = { locked: false }; // Horas
         row.getCell(6).protection = { locked: false }; // Cursos
         row.getCell(7).protection = { locked: false }; // Obs
      });

      // Add border to outer box (Rows 5 to end)
      const lastRow = startRow + data.publishers.length;
      // Green border around the table? Image has green header, standard borders inside.

      // --- Footer Summary ---
      // Resumen del Grupo (Dark Grey Header)
      const summaryHeaderRow = lastRow + 2;
      worksheet.mergeCells(`B${summaryHeaderRow}:G${summaryHeaderRow}`);
      const summaryCell = worksheet.getCell(`B${summaryHeaderRow}`);
      summaryCell.value = 'Resumen del Grupo';
      summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF666666' } }; // Dark Grey
      summaryCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      summaryCell.alignment = { horizontal: 'center' };

      // Stats Rows (Visual only in template, usually formulas in real sheet but static here?)
      // Image shows stats. 
      // "Total publicadores: 16"
      // "No informaron: 1"
      // "Total horas: 215"
      // "Total cursos: 0"
      // We can add Formulas!

      // Publicadores (Count of names)
      worksheet.getCell(`B${summaryHeaderRow + 1}`).value = 'Total publicadores:';
      worksheet.getCell(`B${summaryHeaderRow + 1}`).font = { bold: true };
      worksheet.getCell(`G${summaryHeaderRow + 1}`).value = { formula: `COUNTA(B${startRow + 1}:B${lastRow})` };

      // No informaron (Count where Predicó = 'No' or blank?)
      // If Precursor = No? Logic: Predicó="No"
      worksheet.getCell(`B${summaryHeaderRow + 2}`).value = 'No informaron:';
      worksheet.getCell(`B${summaryHeaderRow + 2}`).font = { bold: true };
      worksheet.getCell(`G${summaryHeaderRow + 2}`).value = { formula: `COUNTIF(C${startRow + 1}:C${lastRow}, "No")` };

      // Total Horas
      worksheet.getCell(`B${summaryHeaderRow + 3}`).value = 'Total horas:';
      worksheet.getCell(`B${summaryHeaderRow + 3}`).font = { bold: true };
      worksheet.getCell(`G${summaryHeaderRow + 3}`).value = { formula: `SUM(E${startRow + 1}:E${lastRow})` };

      // Total Cursos
      worksheet.getCell(`B${summaryHeaderRow + 4}`).value = 'Total cursos bíblicos:';
      worksheet.getCell(`B${summaryHeaderRow + 4}`).font = { bold: true };
      worksheet.getCell(`G${summaryHeaderRow + 4}`).value = { formula: `SUM(F${startRow + 1}:F${lastRow})` };

      // Border for summary
      for (let r = summaryHeaderRow; r <= summaryHeaderRow + 4; r++) {
         worksheet.getCell(`B${r}`).border = { left: { style: 'medium' } };
         worksheet.getCell(`G${r}`).border = { right: { style: 'medium' } };
      }
      worksheet.getRow(summaryHeaderRow + 4).getCell('B').border = { bottom: { style: 'medium' }, left: { style: 'medium' } };
      worksheet.getRow(summaryHeaderRow + 4).getCell('G').border = { bottom: { style: 'medium' }, right: { style: 'medium' } };


      // Sheet Protection
      await worksheet.protect('gac_secretario_2025', {
         selectLockedCells: true,
         selectUnlockedCells: true,
         formatCells: false,
         formatColumns: false,
         formatRows: false,
         insertColumns: false,
         insertRows: false,
         insertHyperlinks: false,
         deleteColumns: false,
         deleteRows: false,
         sort: false,
         autoFilter: false,
         pivotTables: false
      });

      // Write Buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // Filename: Informe_Grupo_X_MES_ANO.xlsx
      const cleanGroupName = data.groupName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Informe_${cleanGroupName}_${data.period.replace(' ', '_')}.xlsx`;

      saveAs(blob, filename);
   }
}
