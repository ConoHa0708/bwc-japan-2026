// 既知の短縮サービスにだけ問い合わせ、転送先の URL を読む。転送先のサイトは開かない。
const SHORTENERS = new Set([
  "bit.ly",
  "buff.ly",
  "cutt.ly",
  "goo.gl",
  "is.gd",
  "ow.ly",
  "rb.gy",
  "t.co",
  "t.ly",
  "tinyurl.com",
  "x.gd",
]);
const MAX_HOPS = 3;

export type ExpandResult =
  | { status: "expanded"; final_url: string; hops: number }
  | { status: "not_shortener"; final_url: string; hops: number }
  | { status: "failed"; reason: string; last_url: string; hops: number };

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export async function expandShortUrl(input: string): Promise<ExpandResult> {
  let current = parseHttpUrl(input);
  if (!current) return { status: "failed", reason: "invalid_url", last_url: input, hops: 0 };

  for (let hops = 0; hops <= MAX_HOPS; hops++) {
    if (!SHORTENERS.has(current.hostname.toLowerCase())) {
      return {
        status: hops === 0 ? "not_shortener" : "expanded",
        final_url: current.href,
        hops,
      };
    }
    if (hops === MAX_HOPS) break;

    let response: Response;
    try {
      response = await fetch(current.href, {
        method: "GET",
        redirect: "manual",
        headers: { "Accept-Encoding": "gzip, deflate" },
      });
    } catch {
      return { status: "failed", reason: "fetch_error", last_url: current.href, hops };
    }
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
      return { status: "failed", reason: `no_redirect_${response.status}`, last_url: current.href, hops };
    }
    const next = parseHttpUrl(new URL(location, current).href);
    if (!next) return { status: "failed", reason: "invalid_redirect", last_url: location, hops };
    current = next;
  }
  return { status: "failed", reason: "too_many_redirects", last_url: current.href, hops: MAX_HOPS };
}
