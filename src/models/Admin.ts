import { Schema, model, models } from "mongoose";

export interface AdminDoc {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
}

const AdminSchema = new Schema<AdminDoc>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

export const Admin = models.Admin || model<AdminDoc>("Admin", AdminSchema);
export default Admin;
