import { Schema, model, models } from "mongoose";

export type ServiceBadge = "NEW" | "HOT" | null;

export interface ServiceDoc {
  _id: string;
  slug: string;
  categorySlug: string;
  title: string;
  badge: ServiceBadge;
  href: string | null;
  order: number;
  active: boolean;
}

const ServiceSchema = new Schema<ServiceDoc>(
  {
    slug: { type: String, required: true, unique: true },
    categorySlug: { type: String, required: true, index: true },
    title: { type: String, required: true },
    badge: { type: String, enum: ["NEW", "HOT", null], default: null },
    href: { type: String, default: null },
    order: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

export const Service = models.Service || model<ServiceDoc>("Service", ServiceSchema);
export default Service;
