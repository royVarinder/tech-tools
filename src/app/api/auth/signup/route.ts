import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

const signupSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please provide a valid name, email and password (min 6 characters)." },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;

  await connectToDatabase();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ name, email: email.toLowerCase(), passwordHash });

  return NextResponse.json({ success: true });
}
