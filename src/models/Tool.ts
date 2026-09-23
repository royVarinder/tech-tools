import { Schema, model, models } from "mongoose";

export interface ToolDoc {
  _id: string;
  slug: string;
  category: string;
  icon: string;
  order: number;
  active: boolean;
}

const ToolSchema = new Schema<ToolDoc>(
  {
    slug: { type: String, required: true, unique: true },
    category: { type: String, required: true, default: "pdf" },
    icon: { type: String, required: true, default: "file" },
    order: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

export const Tool = models.Tool || model<ToolDoc>("Tool", ToolSchema);
export default Tool;
