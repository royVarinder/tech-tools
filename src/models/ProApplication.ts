import { Schema, model, models, Types } from "mongoose";

export type ProApplicationStatus = "pending" | "approved" | "rejected";

export interface ProApplicationDoc {
  _id: string;
  userId: Types.ObjectId;
  name: string;
  email: string;
  reason: string;
  status: ProApplicationStatus;
  decidedBy: string | null;
  decidedAt: Date | null;
}

const ProApplicationSchema = new Schema<ProApplicationDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
    },
    decidedBy: { type: String, default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const ProApplication =
  models.ProApplication || model<ProApplicationDoc>("ProApplication", ProApplicationSchema);
export default ProApplication;
