import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts } from 'pdf-lib';

export const maxDuration = 60;

function findDesignationColumn(data: any[]): string {
  if (!data.length) return '';
  const keys = Object.keys(data[0]);
  const banned = ['unite', 'unité', 'qte', 'quant', 'prix', 'montant', 'total', 'pu', 'lot', 'num', 'ref'];
  let bestKey = '';
  let bestScore = 0;

  for (const key of keys) {
    const keyLower = key.toLowerCase().trim();
    if (banned.some(b => keyLower.includes(b))) continue;
    if (!key.trim()) continue;

    let textScore = 0;
    let count = 0;

    for (let i = 0; i < Math.min(data.length, 20); i++) {
      const val = String(data[i][key] || '').trim();
      if (val &&!val.includes('CHAPITRE') &&!val.includes('TOTAL') && val!== '#REF!') {
        count++;
        if (val.length > 10 && isNaN(Number(val))) textScore += val.length;
      }
    }

    if (count > 3 && textScore > bestScore) {
      bestScore = textScore;
      bestKey = key;
    }
  }

  if (!bestKey) {
    bestKey = keys.find(k => k.trim() &&!banned.some(b => k.toLowerCase().includes(b))) || keys[1] || '';
  }
  return bestKey;
}

function findUnitColumn(data: any[], keys: string[]): string {
  return keys.find(k => {
    const kl = k.toLowerCase();
    return kl.includes('unit') || kl === 'u' || kl === 'u.' || kl === 'un';
  }) || '';
}

export async function POST(req: NextRequest) {
  console.log('START');
  try {
    const formData = await req.formData();
    const dpgfFile = formData.get('dpgf') as File;
    if (!dpgfFile) return NextResponse.json({ error: 'DPGF manquant' }, { status: 400 });

    const dpgfBuffer = Buffer.from(await dpgfFile.arrayBuffer());
    const workbook = XLSX.read(dpgfBuffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    let headerRowIndex = rawData.findIndex((row: any) => {
      const values = Object.values(row).map(v => String(v).toLowerCase());
      return values.some(v => v.includes('prestation') || v.includes('design') || v.includes('libell') || v.includes('ouvrage'));
    });

    if (headerRowIndex === -1) headerRowIndex = 4;

    const dpgfData = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex, defval: '' });
    console.log('Header ligne:', headerRowIndex + 1);
    console.log('Colonnes:', Object.keys(dpgfData[0] || {}));

    const designationKey = findDesignationColumn(dpgfData);
    const unitKey = findUnitColumn(dpgfData, Object.keys(dpgfData[0] || {}));

    console.log('Colonne désignation détectée:', designationKey);
    console.log('Colonne unité détectée:', unitKey);

    const designations = (dpgfData as any[])
   .map(row => {
       const prestation = String(row[designationKey] || '').trim();
       const unit = String(row[unitKey] || '').trim();
       return { prestation, unit };
     })
   .filter(r =>
       r.prestation &&
       r.prestation.length > 5 &&
     !r.prestation.toUpperCase().includes('CHAPITRE') &&
     !r.prestation.toUpperCase().includes('TOTAL') &&
       r.prestation!== '#REF!'
     )
   .slice(0, 15);

    console.log('Nb prestations trouvées:', designations.length);

    if (designations.length === 0) {
      return NextResponse.json({ error: 'Aucune prestation détectée dans le DPGF' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'Clé API Groq manquante' }, { status: 500 });
    }

    const promptList = designations.map(d => d.unit? `${d.prestation} (${d.unit})` : d.prestation);

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
            content: 'Tu es économiste BTP France. Réponds UNIQUEMENT en JSON: {"resultats":[{"prix":"450€/Ft"}]}. Prix HT moyens France. Garde l\'unité donnée entre parenthèses.',
          },
          {
            role: 'user',
            content: JSON.stringify(promptList),
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.log('Groq HTTP Error:', res.status, errorText);
      return NextResponse.json({ error: `Groq erreur ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const content = data.choices[0].message.content;
    console.log('Groq OK');

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

    page.drawText('DPGF Chiffré - LightAO', { x: 50, y, size: 16, font: fontBold });
    y -= 30;

    designations.forEach((d, i) => {
      const prix = prixData.resultats?.[i]?.prix || 'N/A';
      const unitText = d.unit? `(${d.unit})` : '';
      const line = `${d.prestation.slice(0, 45)} ${unitText} : ${prix}`;
      page.drawText(line, { x: 50, y, size: 9, font });
      y -= 14;
      if (y < 50) return;
    });

    const pdfBytes = await pdfDoc.save();
    console.log('PDF OK');
    return new NextResponse(pdfBytes, { headers: { 'Content-Type': 'application/pdf' } });

  } catch (error) {
    console.error('ERREUR FINALE:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
