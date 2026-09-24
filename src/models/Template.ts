import { Schema, model, models } from "mongoose";

export interface TemplateDoc {
  _id: string;
  toolSlug: string;
  name: string;
  layoutKey: string;
  thumbnailUrl: string | null;
  description: string | null;
  order: number;
  active: boolean;
}

const TemplateSchema = new Schema<TemplateDoc>(
  {
    toolSlug: { type: String, required: true, index: true },
    name: { type: String, required: true },
    layoutKey: { type: String, required: true },
    thumbnailUrl: { type: String, default: null },
    description: { type: String, default: null },
    order: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

export const Template = models.Template || model<TemplateDoc>("Template", TemplateSchema);
export default Template;
