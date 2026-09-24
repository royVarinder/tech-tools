import { Schema, model, models } from "mongoose";

export interface VisitorAction {
  path: string;
  locale?: string;
  userId?: string;
  email?: string;
  userAgent?: string;
  referer?: string;
  at: Date;
}

export interface VisitorDoc {
  _id: string;
  ip: string;
  visitCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  actions: VisitorAction[];
}

const VisitorActionSchema = new Schema<VisitorAction>(
  {
    path: { type: String, required: true },
    locale: { type: String },
    userId: { type: String },
    email: { type: String },
    userAgent: { type: String },
    referer: { type: String },
    at: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const VisitorSchema = new Schema<VisitorDoc>(
  {
    ip: { type: String, required: true, unique: true, trim: true },
    visitCount: { type: Number, required: true, default: 0 },
    firstSeenAt: { type: Date, required: true, default: Date.now },
    lastSeenAt: { type: Date, required: true, default: Date.now },
    actions: { type: [VisitorActionSchema], required: true, default: [] },
  },
  { timestamps: true }
);

export const Visitor = models.Visitor || model<VisitorDoc>("Visitor", VisitorSchema);
export default Visitor;
