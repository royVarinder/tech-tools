import { Schema, model, models } from "mongoose";

export interface CategoryDoc {
  _id: string;
  slug: string;
  title: string;
  note?: string;
  order: number;
  active: boolean;
}

const CategorySchema = new Schema<CategoryDoc>(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    note: { type: String },
    order: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

export const Category = models.Category || model<CategoryDoc>("Category", CategorySchema);
export default Category;
