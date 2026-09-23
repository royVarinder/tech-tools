import { Schema, model, models } from "mongoose";

export interface FaqDoc {
  _id: string;
  question: string;
  answer: string;
  order: number;
  active: boolean;
}

const FaqSchema = new Schema<FaqDoc>(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

export const Faq = models.Faq || model<FaqDoc>("Faq", FaqSchema);
export default Faq;
