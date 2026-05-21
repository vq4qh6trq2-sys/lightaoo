import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  console.log('START');
  try {
    const formData = await req.formData();
    const dpgfFile = formData.get('dpgf') as File;
    if (!dpgfFile) return NextResponse.json({ error: 'DPGF manquant' }, { status: 400 });

    const dpgfBuffer = Buffer.from(await dpgfFile.arrayBuffer());
    const workbook = XLSX.read(dpgfBuffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // On démarre à la ligne 5 : là où y'a PRESTATIONS, UNITES, etc
    const dpgfData = XLSX.utils.sheet_to_json(sheet, { range: 5, defval: '' });

    console.log('Nb lignes lues:', dpgfData.length);
    console.log('Exemple ligne:', dpgfData[0]);

    const designations = (dpgfData as any[])
    .map(row => {
       const prestation = String(row['PRESTATIONS'] || '').trim();
       const unit = String(row['UNITES'] || '').trim();
       return { prestation, unit };
     })
    .filter(r =>
       r.prestation &&
      !r.prestation.toUpperCase().includes('CHAPITRE') &&
      !r.prestation.toUpperCase().includes('TOTAL') &&
       r.prestation!== '#REF!'
     )
    .slice(0, 10); // Max 10 pour test

    console.log('Designations extraites:', designations.map(d => d.prestation));

    if (designations.length === 0) {
      return NextResponse.json({ error: 'Aucune prestation trouvée. Vérifie le DPGF.' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'Clé API Groq manquante' }, { status: 500 });
    }

    const promptList = designations.map(d => `${d.prestation} (${d.unit})`);

    console.log('Call Groq...');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'Tu es économiste BTP France. Réponds UNIQUEMENT en JSON: {"resultats":[{"prix":"450€/Ft"}]}. Prix HT moyens France. Garde l\'unité donnée.',
          },
          {
            role: 'user',
            content: `Donne le prix HT pour: ${JSON.stringify(promptList)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.log('Groq HTTP Error:', res.status, errorText);
      return NextResponse.json({ error: `Groq erreur ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const content = data.choices[0].message.content;
    console.log('Groq raw:', content);

    let prixData;
    try {
      prixData = JSON.parse(content);
    } catch (e) {
      return NextResponse.json({ error: 'Groq format invalide' }, { status: 500 });
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let y = 800;

    page.drawText('DPGF Chiffre - Lot 2 EP/SL', { x: 50, y, size: 16, font: fontBold });
    y -= 30;
    page.drawText('Prestation | Unité | Prix HT estimé', { x: 50, y, size: 12, font: fontBold });
    y -= 20;

    designations.forEach((d, i) => {
      const prix = prixData.resultats?.[i]?.prix || 'Non estimé';
      const line = `${d.prestation.slice(0, 40)} | ${d.unit} | ${prix}`;
      page.drawText(line, { x: 50, y, size: 10, font });
      y -= 15;
      if (y < 50) return; // Évite de sortir de la page
    });

    const pdfBytes = await pdfDoc.save();
    console.log('PDF OK');
    return new NextResponse(pdfBytes, { headers: { 'Content-Type': 'application/pdf' } });

  } catch (error) {
    console.error('ERREUR FINALE:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
