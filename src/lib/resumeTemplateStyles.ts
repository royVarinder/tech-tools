export interface ResumeTemplateStyle {
  layoutKey: string;
  accentColor: [number, number, number];
  accentColorCss: string;
  fontFamily: "Helvetica" | "TimesRoman";
  columns: 1 | 2;
  headerStyle: "minimal" | "banner" | "sidebar";
}

export const RESUME_TEMPLATE_STYLES: Record<string, ResumeTemplateStyle> = {
  classic: {
    layoutKey: "classic",
    accentColor: [0.24, 0.28, 0.35],
    accentColorCss: "#3d4759",
    fontFamily: "TimesRoman",
    columns: 1,
    headerStyle: "minimal",
  },
  "modern-blue": {
    layoutKey: "modern-blue",
    accentColor: [0.145, 0.388, 0.922],
    accentColorCss: "#2563eb",
    fontFamily: "Helvetica",
    columns: 1,
    headerStyle: "banner",
  },
  minimalist: {
    layoutKey: "minimalist",
    accentColor: [0.45, 0.45, 0.48],
    accentColorCss: "#737480",
    fontFamily: "Helvetica",
    columns: 1,
    headerStyle: "minimal",
  },
  "sidebar-dark": {
    layoutKey: "sidebar-dark",
    accentColor: [0.12, 0.13, 0.16],
    accentColorCss: "#1f2128",
    fontFamily: "Helvetica",
    columns: 2,
    headerStyle: "sidebar",
  },
  "bold-header": {
    layoutKey: "bold-header",
    accentColor: [0.42, 0.15, 0.55],
    accentColorCss: "#6b268c",
    fontFamily: "Helvetica",
    columns: 1,
    headerStyle: "banner",
  },
  "elegant-green": {
    layoutKey: "elegant-green",
    accentColor: [0.11, 0.42, 0.28],
    accentColorCss: "#1c6b47",
    fontFamily: "TimesRoman",
    columns: 1,
    headerStyle: "minimal",
  },
};

export function getResumeTemplateStyle(layoutKey: string): ResumeTemplateStyle {
  return RESUME_TEMPLATE_STYLES[layoutKey] ?? RESUME_TEMPLATE_STYLES.classic;
}
