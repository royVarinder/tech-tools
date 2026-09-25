import { Schema, model, models } from "mongoose";

export interface JobDoc {
  _id: string;
  title: string;
  posts: number;
  board: string;
  qualification: string;
  advtNo: string;
  state: string;
  postDate: Date;
  lastDate: Date;
  applyLink: string | null;
}

const JobSchema = new Schema<JobDoc>(
  {
    title: { type: String, required: true, trim: true },
    posts: { type: Number, required: true, default: 1, min: 1 },
    board: { type: String, required: true, trim: true },
    qualification: { type: String, required: true, trim: true },
    advtNo: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true, default: "All India" },
    postDate: { type: Date, required: true },
    // TTL index: MongoDB automatically deletes the document once `lastDate` is in the past.
    lastDate: { type: Date, required: true, expires: 0 },
    applyLink: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

export const Job = models.Job || model<JobDoc>("Job", JobSchema);
export default Job;
