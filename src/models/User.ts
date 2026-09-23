import { Schema, model, models } from "mongoose";

export interface RecentToolEntry {
  slug: string;
  usedAt: Date;
}

export interface UserDoc {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  recentTools: RecentToolEntry[];
}

const RecentToolSchema = new Schema<RecentToolEntry>(
  {
    slug: { type: String, required: true },
    usedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const UserSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    recentTools: { type: [RecentToolSchema], required: true, default: [] },
  },
  { timestamps: true }
);

export const User = models.User || model<UserDoc>("User", UserSchema);
export default User;
