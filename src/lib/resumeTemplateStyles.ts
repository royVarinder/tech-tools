export interface ResumeTemplateStyle {
  layoutKey: string;
  accentColor: [number, number, number];
  accentColorCss: string;
  fontFamily: "Helvetica" | "TimesRoman";
  columns: 1 | 2;
  headerStyle: "minimal" | "banner" | "sidebar";
  bannerHeight: number;
  bannerNameSize: number;
  spacingScale: number;
}

export const RESUME_TEMPLATE_STYLES: Record<string, ResumeTemplateStyle> = {
  classic: {
    layoutKey: "classic",
    accentColor: [0.24, 0.28, 0.35],
    accentColorCss: "#3d4759",
    fontFamily: "TimesRoman",
    columns: 1,
    headerStyle: "minimal",
    bannerHeight: 90,
    bannerNameSize: 24,
    spacingScale: 1,
  },
  "modern-blue": {
    layoutKey: "modern-blue",
    accentColor: [0.145, 0.388, 0.922],
    accentColorCss: "#2563eb",
    fontFamily: "Helvetica",
    columns: 1,
    headerStyle: "banner",
    bannerHeight: 90,
    bannerNameSize: 24,
    spacingScale: 1,
  },
  minimalist: {
    layoutKey: "minimalist",
    accentColor: [0.45, 0.45, 0.48],
    accentColorCss: "#737480",
    fontFamily: "Helvetica",
    columns: 1,
    headerStyle: "minimal",
    bannerHeight: 90,
    bannerNameSize: 24,
    spacingScale: 1.35,
  },
  "sidebar-dark": {
    layoutKey: "sidebar-dark",
    accentColor: [0.12, 0.13, 0.16],
    accentColorCss: "#1f2128",
    fontFamily: "Helvetica",
    columns: 2,
    headerStyle: "sidebar",
    bannerHeight: 90,
    bannerNameSize: 24,
    spacingScale: 1,
  },
  "bold-header": {
    layoutKey: "bold-header",
    accentColor: [0.42, 0.15, 0.55],
    accentColorCss: "#6b268c",
    fontFamily: "Helvetica",
    columns: 1,
    headerStyle: "banner",
    bannerHeight: 130,
    bannerNameSize: 30,
    spacingScale: 1,
  },
  "elegant-green": {
    layoutKey: "elegant-green",
    accentColor: [0.11, 0.42, 0.28],
    accentColorCss: "#1c6b47",
    fontFamily: "TimesRoman",
    columns: 1,
    headerStyle: "minimal",
    bannerHeight: 90,
    bannerNameSize: 24,
    spacingScale: 1.15,
  },
};

export const RESUME_LAYOUT_KEYS = Object.keys(RESUME_TEMPLATE_STYLES);

export function getResumeTemplateStyle(layoutKey: string): ResumeTemplateStyle {
  return RESUME_TEMPLATE_STYLES[layoutKey] ?? RESUME_TEMPLATE_STYLES.classic;
}
