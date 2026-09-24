import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getResumeTemplateStyle } from "./resumeTemplateStyles";

export interface ResumeExperienceEntry {
  company: string;
  role: string;
  period: string;
  description: string;
}

export interface ResumeEducationEntry {
  school: string;
  degree: string;
  period: string;
}

export interface ResumeData {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  experience: ResumeExperienceEntry[];
  education: ResumeEducationEntry[];
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const SIDEBAR_WIDTH = 190;
const SIDEBAR_GUTTER = 24;
const SIDEBAR_PADDING_X = 20;

function splitLongWord(word: string, size: number, usedFont: PDFFont, maxWidth: number): string[] {
  const chunks: string[] = [];
  let chunk = "";
  for (const char of word) {
    const testChunk = chunk + char;
    if (usedFont.widthOfTextAtSize(testChunk, size) > maxWidth && chunk) {
      chunks.push(chunk);
      chunk = char;
    } else {
      chunk = testChunk;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function wrapTextLines(text: string, size: number, usedFont: PDFFont, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (usedFont.widthOfTextAtSize(word, size) > maxWidth) {
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(...splitLongWord(word, size, usedFont, maxWidth));
      continue;
    }
    const testLine = line ? `${line} ${word}` : word;
    if (usedFont.widthOfTextAtSize(testLine, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function generateResumePdf(data: ResumeData, layoutKey: string): Promise<Uint8Array> {
  const style = getResumeTemplateStyle(layoutKey);
  const isSerif = style.fontFamily === "TimesRoman";
  const scale = style.spacingScale;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(isSerif ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(isSerif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold);
  const accent = rgb(...style.accentColor);
  const hasSidebar = style.columns === 2;
  const leftX = MARGIN + (hasSidebar ? SIDEBAR_WIDTH + SIDEBAR_GUTTER : 0);
  const rightEdge = PAGE_WIDTH - MARGIN;
  const contentWidth = rightEdge - leftX;

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function drawSidebarBackground(target: PDFPage) {
    if (!hasSidebar) return;
    target.drawRectangle({
      x: 0,
      y: 0,
      width: SIDEBAR_WIDTH + MARGIN,
      height: PAGE_HEIGHT,
      color: accent,
    });
  }
  drawSidebarBackground(page);
  const firstPage = page;

  function newPage() {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawSidebarBackground(page);
    y = PAGE_HEIGHT - MARGIN;
  }

  function ensureSpace(lineHeight: number) {
    if (y - lineHeight < MARGIN) newPage();
  }

  function drawWrapped(
    text: string,
    x: number,
    width: number,
    options: { size: number; font: PDFFont; color?: ReturnType<typeof rgb>; gap?: number }
  ) {
    const { size, font: usedFont, color = rgb(0.15, 0.15, 0.18), gap = size * 1.4 * scale } = options;
    const words = text.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const w = usedFont.widthOfTextAtSize(testLine, size);
      if (w > width && line) {
        ensureSpace(gap);
        page.drawText(line, { x, y, size, font: usedFont, color });
        y -= gap;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ensureSpace(gap);
      page.drawText(line, { x, y, size, font: usedFont, color });
      y -= gap;
    }
  }

  function drawHeading(text: string) {
    ensureSpace(26 * scale);
    y -= 6 * scale;
    page.drawText(text.toUpperCase(), { x: leftX, y, size: 12, font: boldFont, color: accent });
    y -= 4 * scale;
    page.drawLine({
      start: { x: leftX, y },
      end: { x: rightEdge, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.9),
    });
    y -= 14 * scale;
  }

  // Header
  if (style.headerStyle === "banner") {
    const bannerHeight = style.bannerHeight;
    const nameSize = style.bannerNameSize;
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - bannerHeight, width: PAGE_WIDTH, height: bannerHeight, color: accent });
    page.drawText(data.name || "Your Name", {
      x: MARGIN,
      y: PAGE_HEIGHT - nameSize - 16,
      size: nameSize,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    if (data.title) {
      page.drawText(data.title, {
        x: MARGIN,
        y: PAGE_HEIGHT - nameSize - 44,
        size: 13,
        font,
        color: rgb(0.95, 0.95, 0.98),
      });
    }
    y = PAGE_HEIGHT - bannerHeight - 24;
    const contactLine = [data.email, data.phone, data.location].filter(Boolean).join("   •   ");
    if (contactLine) {
      page.drawText(contactLine, { x: MARGIN, y, size: 10, font, color: rgb(0.4, 0.4, 0.45) });
      y -= 20 * scale;
    }
  } else if (style.headerStyle === "sidebar") {
    const sidebarInnerWidth = SIDEBAR_WIDTH + MARGIN - SIDEBAR_PADDING_X * 2;
    let sy = PAGE_HEIGHT - MARGIN;
    firstPage.drawText(data.name || "Your Name", { x: SIDEBAR_PADDING_X, y: sy, size: 16, font: boldFont, color: rgb(1, 1, 1) });
    sy -= 22;
    if (data.title) {
      firstPage.drawText(data.title, { x: SIDEBAR_PADDING_X, y: sy, size: 10, font, color: rgb(0.85, 0.85, 0.9) });
      sy -= 24;
    } else {
      sy -= 10;
    }
    if (data.email || data.phone || data.location) {
      firstPage.drawText("CONTACT", { x: SIDEBAR_PADDING_X, y: sy, size: 9, font: boldFont, color: rgb(1, 1, 1) });
      sy -= 16;
      for (const entry of [data.email, data.phone, data.location].filter(Boolean)) {
        for (const line of wrapTextLines(entry, 9, font, sidebarInnerWidth)) {
          firstPage.drawText(line, { x: SIDEBAR_PADDING_X, y: sy, size: 9, font, color: rgb(0.85, 0.85, 0.9) });
          sy -= 13;
        }
      }
      sy -= 10;
    }
    if (data.skills.length > 0) {
      firstPage.drawText("SKILLS", { x: SIDEBAR_PADDING_X, y: sy, size: 9, font: boldFont, color: rgb(1, 1, 1) });
      sy -= 16;
      for (const skill of data.skills) {
        for (const line of wrapTextLines(`• ${skill}`, 9, font, sidebarInnerWidth)) {
          if (sy < MARGIN) break;
          firstPage.drawText(line, { x: SIDEBAR_PADDING_X, y: sy, size: 9, font, color: rgb(0.85, 0.85, 0.9) });
          sy -= 13;
        }
      }
    }
    y = PAGE_HEIGHT - MARGIN;
  } else {
    page.drawText(data.name || "Your Name", { x: leftX, y, size: 22, font: boldFont, color: rgb(0.1, 0.1, 0.15) });
    y -= 26 * scale;
    if (data.title) {
      page.drawText(data.title, { x: leftX, y, size: 13, font, color: accent });
      y -= 20 * scale;
    }
    const contactLine = [data.email, data.phone, data.location].filter(Boolean).join("   •   ");
    if (contactLine) {
      page.drawText(contactLine, { x: leftX, y, size: 10, font, color: rgb(0.4, 0.4, 0.45) });
      y -= 20 * scale;
    }
  }

  if (data.summary) {
    drawHeading("Summary");
    drawWrapped(data.summary, leftX, contentWidth, { size: 10.5, font });
    y -= 6 * scale;
  }

  const experienceEntries = data.experience.filter((e) => e.company || e.role);
  if (experienceEntries.length > 0) {
    drawHeading("Experience");
    for (const exp of experienceEntries) {
      ensureSpace(16 * scale);
      page.drawText(`${exp.role || "Role"} — ${exp.company || "Company"}`, {
        x: leftX,
        y,
        size: 11,
        font: boldFont,
      });
      if (exp.period) {
        const periodWidth = font.widthOfTextAtSize(exp.period, 9.5);
        page.drawText(exp.period, {
          x: rightEdge - periodWidth,
          y,
          size: 9.5,
          font,
          color: rgb(0.45, 0.45, 0.5),
        });
      }
      y -= 16 * scale;
      if (exp.description) {
        drawWrapped(exp.description, leftX, contentWidth, { size: 10, font, color: rgb(0.3, 0.3, 0.35) });
      }
      y -= 6 * scale;
    }
  }

  const educationEntries = data.education.filter((e) => e.school || e.degree);
  if (educationEntries.length > 0) {
    drawHeading("Education");
    for (const edu of educationEntries) {
      ensureSpace(16 * scale);
      page.drawText(`${edu.degree || "Degree"} — ${edu.school || "School"}`, {
        x: leftX,
        y,
        size: 11,
        font: boldFont,
      });
      if (edu.period) {
        const periodWidth = font.widthOfTextAtSize(edu.period, 9.5);
        page.drawText(edu.period, {
          x: rightEdge - periodWidth,
          y,
          size: 9.5,
          font,
          color: rgb(0.45, 0.45, 0.5),
        });
      }
      y -= 20 * scale;
    }
  }

  if (data.skills.length > 0 && !hasSidebar) {
    drawHeading("Skills");
    drawWrapped(data.skills.join("   •   "), leftX, contentWidth, { size: 10.5, font });
  }

  return pdfDoc.save();
}
