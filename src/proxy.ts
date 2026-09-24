import type { NextFetchEvent } from "next/server";
import type { NextAuthRequest } from "next-auth";
import createMiddleware from "next-intl/middleware";
import { routing, locales } from "./i18n/routing";
import { auth } from "./auth";
import { getClientIp } from "./lib/getClientIp";
import { recordVisit } from "./lib/trackVisit";

const intlMiddleware = createMiddleware(routing);

export default auth((request: NextAuthRequest, event: NextFetchEvent) => {
  const response = intlMiddleware(request);

  const pathname = request.nextUrl.pathname;
  const firstSegment = pathname.split("/")[1];
  const locale = (locales as readonly string[]).includes(firstSegment) ? firstSegment : undefined;

  event.waitUntil(
    recordVisit(getClientIp(request), {
      path: pathname,
      locale,
      userId: request.auth?.user?.id,
      email: request.auth?.user?.email ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
      referer: request.headers.get("referer") ?? undefined,
    })
  );

  return response;
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
