import { closeBrowser, openLoginWindow } from "@/lib/browser";

export const dynamic = "force-dynamic";

const LOGIN_URLS = [
  "https://signin.ebay.fr/ws/eBayISAPI.dll?SignIn",
  "https://www.facebook.com/login",
  "https://www.vinted.fr/",
];

export async function POST(req: Request) {
  const { action } = (await req.json()) as { action: "login" | "close" };
  try {
    if (action === "login") await openLoginWindow(LOGIN_URLS);
    else await closeBrowser();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
