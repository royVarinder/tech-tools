export type ToolCategory = "pdf" | "image" | "document";

export interface ToolDefinition {
  slug: string;
  category: ToolCategory;
  icon: string;
  order: number;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  { slug: "jpg-to-pdf", category: "pdf", icon: "image-plus", order: 1 },
  { slug: "pdf-to-jpg", category: "image", icon: "file-image", order: 2 },
  { slug: "png-to-pdf", category: "pdf", icon: "image-plus", order: 3 },
  { slug: "png-to-jpg", category: "image", icon: "image", order: 4 },
  { slug: "delete-pdf-page", category: "pdf", icon: "file-x", order: 5 },
  { slug: "merge-pdf", category: "pdf", icon: "files", order: 6 },
  { slug: "photo-crop-resize", category: "image", icon: "crop", order: 7 },
  { slug: "resume-maker", category: "document", icon: "file-text", order: 8 },
  { slug: "passport-photo", category: "image", icon: "camera-id", order: 9 },
  { slug: "id-card-print", category: "document", icon: "id-card", order: 10 },
  { slug: "pro-resume-maker", category: "document", icon: "pro-resume-maker", order: 11 },
];
