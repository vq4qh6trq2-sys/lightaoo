import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const cctpFile = formData.get('cctp') as File;
    const dpgfFile = formData.get('dpgf') as File;

    if (!cctpFile ||!dpgfFile) {
      return NextResponse.json({ error: 'Fichiers manquants' }, { status: 400 });
    }

    const cctpBuffer = Buffer.from(await cctpFile.arrayBuffer());
    await mammoth.extractRawText({ buffer: cctpBuffer });

    const dpgfBuffer = Buffer.from(await dpgfFile.arrayBuffer());
    const workbook = XLSX.read(dpgfBuffer);
    const dpgfData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const results = [];
    for (const lot of dpgfData as any[]) {
      const designation = lot['Désignation'] || lot['Designation'] || lot['Libellé'] || lot['description'];
      if (!designation) continue;

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mixtral-8x7b-32768',
          messages: [
            {
              role: 'system',
              content: 'Tu es économiste BTP France. Réponds UNIQUEMENT par un prix formaté: 450€/m². Jamais de phrase.',
            },
            {
              role: 'user',
              content: `Prix HT pour: ${designation}. Format: 450€/m²`,
            },
          ],
          temperature: 0,
          max_tokens: 10,
        }),
      });

      if (!res.ok) {
        results.push({ lot: lot['Lot'] || '', designation, prixEstime: 'Erreur API' });
        continue;
      }

      const data = await res.json();
      let prixEstime = data.choices?.[0]?.message?.content?.trim() || 'N/A';
      if (/^\d+$/.test(prixEstime)) prixEstime = `${prixEstime}€`;

      results.push({
        lot: lot['Lot'] || lot['lot'] || '',
        designation,
        prixEstime,
      });
    }

    // Génère le PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = 800;
    page.drawText('DPGF Chiffré - LightAO', { x: 50, y, size: 18, font, color: rgb(0, 0, 0) });
    y -= 40;
    page.drawText('Lot | Désignation | Prix HT', { x: 50, y, size: 12, font });
    y -= 25;

    for (const r of results) {
      const line = `${r.lot} | ${r.designation} | ${r.prixEstime}`;
      page.drawText(line.slice(0, 85), { x: 50, y, size: 10, font: fontRegular });
      y -= 15;
      if (y < 50) break;
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="dpgf_chiffre.pdf"',
      },
    });
  } catch (error) {
    console.error('ERREUR API MATCH:', error);
    return NextResponse.json({ error: 'Erreur serveur', details: String(error) }, { status: 500 });
  }
}
