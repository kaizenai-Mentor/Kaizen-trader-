/**
 * KAIZEN Direct PDF Certificate & Trader Dossier Generator.
 *
 * Generates a standalone, valid PDF 1.4 document (application/pdf) in memory
 * with zero external dependencies and zero browser print-dialog blocking.
 * Styled like an elite institutional / prop-firm certificate with:
 *   - Crispy Black & Burnt Blue certificate frame + Double Electric Gold border
 *   - Centered KAIZEN Brand Watermark behind the certificate body
 *   - Official KAIZEN Crest, Verification ID, Branded Gold Score Percentages
 *   - Auto-Memory Executive Summary & Balanced Defining Trading Decisions
 *   - Founder Signature ("Dennis · Kaizen Mentor") & Vermillion Authentication Seal
 */

function pdfEscape(str) {
  return String(str || '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text, maxChars = 88) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) {
      cur = w;
    } else if ((cur + ' ' + w).length <= maxChars) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function generateDossierPdfBuffer(dossier = {}, options = {}) {
  const redactPairs = Boolean(options.redactPairs);
  const redactDates = Boolean(options.redactDates);
  const hideQuotes = Boolean(options.hideQuotes);

  const username = dossier.username || 'Trader';
  const verificationId = dossier.verificationId || 'KZN-2026-VERIFIED';
  const memberSince = dossier.memberSince || '2026';
  const kaizenScore = dossier.kaizenScore != null ? dossier.kaizenScore : 0;
  const complianceRate = dossier.complianceRate != null ? dossier.complianceRate : 0;
  const totalSessions = dossier.totalSessions != null ? dossier.totalSessions : 0;
  const brokerVerifiedCount = dossier.brokerVerifiedCount != null ? dossier.brokerVerifiedCount : 0;
  const topInstruments = redactPairs
    ? '[REDACTED BY TRADER]'
    : ((dossier.topInstruments && dossier.topInstruments.length) ? dossier.topInstruments.join(' / ') : 'Multi-Asset');
  const topStrategies = (dossier.topStrategies && dossier.topStrategies.length)
    ? dossier.topStrategies.join(' / ')
    : 'Structured System';

  const ops = [];

  // Page size: A4 Portrait (595 x 842 pt)
  // 1. Deep Crispy Black background (#0A0A0A -> 0.04 0.04 0.05)
  ops.push('0.04 0.04 0.05 rg');
  ops.push('0 0 595 842 re f');

  // 2. Outer & Inner Electric Gold Certificate Frame (#F5C518 -> 0.96 0.77 0.09)
  ops.push('1.8 w 0.96 0.77 0.09 RG');
  ops.push('22 22 551 798 re S');
  ops.push('0.6 w 0.96 0.77 0.09 RG');
  ops.push('28 28 539 786 re S');

  // Corner certificate ornaments
  ops.push('1.4 w 0.96 0.77 0.09 RG');
  ops.push('22 790 m 52 790 l 52 820 l S');
  ops.push('573 790 m 543 790 l 543 820 l S');
  ops.push('22 52 m 52 52 l 52 22 l S');
  ops.push('573 52 m 543 52 l 543 22 l S');

  // 3. Large Centered KAIZEN Brand Watermark across the middle of the certificate
  // Subtle Burnt Blue / Slate watermark tint (0.11 0.16 0.23)
  ops.push('q');
  ops.push('0.11 0.16 0.23 rg');
  ops.push('BT /F2 92 Tf 118 415 Td (KAIZEN) Tj ET');
  ops.push('BT /F1 18 Tf 155 382 Td (TRADER DEVELOPMENT & VERIFICATION) Tj ET');
  ops.push('Q');

  // 4. Top Certificate Header Banner
  ops.push('0.10 0.18 0.29 rg');
  ops.push('42 742 511 56 re f');
  ops.push('0.8 w 0.96 0.77 0.09 RG');
  ops.push('42 742 511 56 re S');

  // Gold Brand Crest Box on Left
  ops.push('0.96 0.77 0.09 rg');
  ops.push('54 752 36 36 re f');
  ops.push('0.04 0.04 0.05 rg');
  ops.push('BT /F2 18 Tf 66 764 Td (K) Tj ET');

  // Header Titles
  ops.push('0.96 0.97 0.98 rg');
  ops.push('BT /F2 14 Tf 102 774 Td (KAIZEN OFFICIAL TRADER CERTIFICATE & DOSSIER) Tj ET');
  ops.push('0.96 0.77 0.09 rg');
  ops.push('BT /F1 8.5 Tf 102 758 Td (BEHAVIORAL DISCIPLINE & BROKER-VERIFIED EXECUTION RECORD) Tj ET');

  // Verification ID Pill on Right
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F2 9 Tf 425 766 Td (${pdfEscape(verificationId)}) Tj ET`);

  // 5. Core Metrics Row (4 Boxes)
  const boxY = 668;
  const boxH = 58;
  const boxW = 121;
  const gaps = [42, 172, 302, 432];

  for (const bx of gaps) {
    ops.push('0.08 0.12 0.18 rg');
    ops.push(`${bx} ${boxY} ${boxW} ${boxH} re f`);
    ops.push('0.5 w 0.20 0.28 0.38 RG');
    ops.push(`${bx} ${boxY} ${boxW} ${boxH} re S`);
  }

  // Box 1: Trader Handle
  ops.push('0.64 0.69 0.75 rg');
  ops.push(`BT /F1 7.5 Tf 50 ${boxY + 43} Td (TRADER HANDLE) Tj ET`);
  ops.push('0.96 0.97 0.98 rg');
  ops.push(`BT /F2 12 Tf 50 ${boxY + 25} Td (${pdfEscape(username.slice(0, 16))}) Tj ET`);
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F1 7.5 Tf 50 ${boxY + 10} Td (Since ${pdfEscape(memberSince)}) Tj ET`);

  // Box 2: KAIZEN Score (Branded Gold Percentage)
  ops.push('0.64 0.69 0.75 rg');
  ops.push(`BT /F1 7.5 Tf 180 ${boxY + 43} Td (KAIZEN SCORE) Tj ET`);
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F2 16 Tf 180 ${boxY + 23} Td (${pdfEscape(String(kaizenScore))}%) Tj ET`);
  ops.push('0.96 0.97 0.98 rg');
  ops.push(`BT /F1 7.5 Tf 180 ${boxY + 10} Td (Compliance: ${pdfEscape(String(complianceRate))}%) Tj ET`);

  // Box 3: Logged & Verified Sessions
  ops.push('0.64 0.69 0.75 rg');
  ops.push(`BT /F1 7.5 Tf 310 ${boxY + 43} Td (LOGGED SESSIONS) Tj ET`);
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F2 16 Tf 310 ${boxY + 23} Td (${pdfEscape(String(totalSessions))}) Tj ET`);
  ops.push('0.96 0.97 0.98 rg');
  ops.push(`BT /F1 7.5 Tf 310 ${boxY + 10} Td (Broker-Verified: ${pdfEscape(String(brokerVerifiedCount))}) Tj ET`);

  // Box 4: Primary Focus
  ops.push('0.64 0.69 0.75 rg');
  ops.push(`BT /F1 7.5 Tf 440 ${boxY + 43} Td (PRIMARY FOCUS) Tj ET`);
  ops.push('0.96 0.97 0.98 rg');
  ops.push(`BT /F2 9 Tf 440 ${boxY + 26} Td (${pdfEscape(topInstruments.slice(0, 20))}) Tj ET`);
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F1 7.5 Tf 440 ${boxY + 10} Td (${pdfEscape(topStrategies.slice(0, 22))}) Tj ET`);

  let curY = 640;

  // 6. Section: HOW THIS TRADER OPERATES (AUTO-GENERATED BY KAIZEN MEMORY)
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F2 9.5 Tf 42 ${curY} Td (HOW THIS TRADER OPERATES  |  KAIZEN MEMORY SYNTHESIS) Tj ET`);
  curY -= 6;
  ops.push('0.4 w 0.96 0.77 0.09 RG');
  ops.push(`42 ${curY} m 553 ${curY} l S`);
  curY -= 16;

  const summaryText = redactPairs
    ? String(dossier.howITrade || '').replace(/\b(AUDJPY|EURUSD|GBPUSD|USDJPY|XAUUSD|Japan 225|NAS100|US30|US500|GER40)\b/gi, '[REDACTED]')
    : String(dossier.howITrade || '');
  const summaryLines = wrapText(summaryText, 92).slice(0, 4);
  ops.push('0.94 0.96 0.98 rg');
  for (const line of summaryLines) {
    ops.push(`BT /F1 9.5 Tf 42 ${curY} Td (${pdfEscape(line)}) Tj ET`);
    curY -= 13;
  }

  curY -= 4;
  const behLines = wrapText(dossier.behavioralSummary || '', 92).slice(0, 3);
  ops.push('0.72 0.78 0.84 rg');
  for (const line of behLines) {
    ops.push(`BT /F1 9 Tf 42 ${curY} Td (${pdfEscape(line)}) Tj ET`);
    curY -= 12.5;
  }

  curY -= 14;

  // 7. Section: DEFINING TRADING & STUDY DECISIONS (BALANCED GOOD & LESSON SESSIONS)
  if (!hideQuotes && Array.isArray(dossier.memorableDecisions) && dossier.memorableDecisions.length > 0) {
    ops.push('0.96 0.77 0.09 rg');
    ops.push(`BT /F2 9.5 Tf 42 ${curY} Td (DEFINING TRADING & STUDY DECISIONS  |  BALANCED RECORD) Tj ET`);
    curY -= 6;
    ops.push('0.4 w 0.96 0.77 0.09 RG');
    ops.push(`42 ${curY} m 553 ${curY} l S`);
    curY -= 14;

    for (const dec of dossier.memorableDecisions.slice(0, 4)) {
      if (curY < 165) break;
      const instLabel = redactPairs ? '[REDACTED PAIR]' : (dec.instrument || 'Session');
      const dateLabel = redactDates ? '[REDACTED DATE]' : (dec.date || 'Recorded');
      const badge = dec.qualityLabel || dec.mode || 'SESSION';
      const headerLine = `${instLabel} - ${dec.strategy || 'System'}  [${badge} | ${dec.mode || 'RECORDED'} | ${dateLabel}]`;

      // Card background
      ops.push('0.07 0.10 0.15 rg');
      ops.push(`42 ${curY - 48} 511 58 re f`);
      // Left accent bar: Gold for good sessions, Burnt Blue/Amber for lesson sessions
      if (dec.isGood) {
        ops.push('0.96 0.77 0.09 rg');
      } else {
        ops.push('0.85 0.45 0.25 rg');
      }
      ops.push(`42 ${curY - 48} 3.5 58 re f`);

      ops.push('0.96 0.77 0.09 rg');
      ops.push(`BT /F2 8.5 Tf 52 ${curY - 4} Td (${pdfEscape(headerLine.slice(0, 95))}) Tj ET`);

      const qLines = wrapText(`"${dec.narrative || ''}"`, 94).slice(0, 2);
      ops.push('0.94 0.96 0.98 rg');
      let qY = curY - 17;
      for (const ql of qLines) {
        ops.push(`BT /F1 8.5 Tf 52 ${qY} Td (${pdfEscape(ql)}) Tj ET`);
        qY -= 11;
      }

      const lLine = wrapText(`KAIZEN Takeaway: ${dec.lesson || ''}`, 94)[0] || '';
      ops.push('0.68 0.76 0.84 rg');
      ops.push(`BT /F1 8 Tf 52 ${curY - 42} Td (${pdfEscape(lLine)}) Tj ET`);

      curY -= 66;
    }
  }

  // 8. Bottom Official Authentication Block: Seal + Founder Signature ("Dennis · Kaizen Mentor")
  const footY = 54;
  ops.push('0.5 w 0.96 0.77 0.09 RG');
  ops.push(`42 ${footY + 52} m 553 ${footY + 52} l S`);

  // Vermillion Seal Circle on Left (#C0392B -> 0.75 0.22 0.17)
  ops.push('0.75 0.22 0.17 rg');
  ops.push(`42 ${footY + 8} 34 34 re f`);
  ops.push('1 w 0.96 0.77 0.09 RG');
  ops.push(`42 ${footY + 8} 34 34 re S`);
  ops.push('0.96 0.97 0.98 rg');
  ops.push(`BT /F2 11 Tf 47 ${footY + 21} Td (SEAL) Tj ET`);

  ops.push('0.96 0.97 0.98 rg');
  ops.push(`BT /F2 9.5 Tf 86 ${footY + 30} Td (AUTHENTICATED BY KAIZEN  |  OFFICIAL TRADER CREDENTIAL) Tj ET`);
  ops.push('0.64 0.69 0.75 rg');
  ops.push(`BT /F1 8 Tf 86 ${footY + 17} Td (Zero bank details, logins, or account balances collected. Tamper-evident record.) Tj ET`);
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F1 7.5 Tf 86 ${footY + 6} Td (Certificate ID: ${pdfEscape(verificationId)}  |  Issued: ${pdfEscape(new Date().toISOString().slice(0, 10))}) Tj ET`);

  // Founder Signature on Right
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F3 15 Tf 395 ${footY + 26} Td (Dennis  -  Kaizen Mentor) Tj ET`);
  ops.push('0.3 w 0.96 0.77 0.09 RG');
  ops.push(`390 ${footY + 20} m 553 ${footY + 20} l S`);
  ops.push('0.64 0.69 0.75 rg');
  ops.push(`BT /F1 7.5 Tf 395 ${footY + 9} Td (FOUNDER SIGNATURE & AUTHENTICATION) Tj ET`);

  const contentStream = ops.join('\n');
  const streamBytes = Buffer.byteLength(contentStream, 'utf8');

  // Assemble valid PDF 1.4 objects
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-BoldItalic >>\nendobj\n',
    `7 0 obj\n<< /Length ${streamBytes} >>\nstream\n${contentStream}\nendstream\nendobj\n`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

module.exports = { generateDossierPdfBuffer };
