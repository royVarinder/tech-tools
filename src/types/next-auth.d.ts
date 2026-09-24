import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    isPro?: boolean;
  }
  interface Session {
    user: {
      id: string;
      role: "user" | "admin";
      isPro: boolean;
    } & DefaultSession["user"];
  }
}
