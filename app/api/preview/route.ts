import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Platform = "youtube" | "tiktok" | "instagram" | "otro";

interface Preview {
  platform: Platform;
  title: string | null;
  thumbnail_url: string | null;
  url: string;
}

const YT_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];
const TT_HOSTS = ["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "m.tiktok.com"];
const IG_HOSTS = ["instagram.com", "www.instagram.com"];

const CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const MAX_IMAGE_BYTES = 400_000;

function decodeEntities(v: string): string {
  return v
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function metaContent(html: string, prop: string): string | null {
  const a = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`,
    "i"
  ).exec(html);
  const b = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i"
  ).exec(html);
  const v = (a ?? b)?.[1];
  return v ? decodeEntities(v) : null;
}

// Lee las etiquetas Open Graph de la página, igual que hace WhatsApp para su vista previa.
async function fetchOpenGraph(target: string): Promise<{ title: string | null; image: string | null }> {
  try {
    const res = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(7000),
      headers: { "User-Agent": CRAWLER_UA, Accept: "text/html" },
    });
    if (!res.ok) return { title: null, image: null };
    const html = (await res.text()).slice(0, 400_000);
    return {
      title: metaContent(html, "og:title") ?? metaContent(html, "twitter:title"),
      image: metaContent(html, "og:image") ?? metaContent(html, "twitter:image"),
    };
  } catch {
    return { title: null, image: null };
  }
}

// Las miniaturas de TikTok e Instagram son URLs firmadas que expiran. Se descargan
// y se guardan como data URL dentro de la fila para que no se rompan con el tiempo.
async function toDataUrl(imageUrl: string): Promise<string | null> {
  try {
    const u = new URL(imageUrl);
    const isIp = /^[\d.]+$/.test(u.hostname) || u.hostname.includes(":");
    if (u.protocol !== "https:" || isIp || !u.hostname.includes(".") || u.hostname === "localhost") {
      return null;
    }
    const res = await fetch(u, { signal: AbortSignal.timeout(7000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) return null;
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function youtubeId(u: URL): string | null {
  if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
  if (u.pathname === "/watch") return u.searchParams.get("v");
  const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/);
  return m ? m[1] : null;
}

async function fetchJson(endpoint: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SomaDash/1.0)" },
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Devuelve plataforma, título y miniatura de un link. Solo consulta los hosts de arriba
// (nunca una URL arbitraria), y requiere sesión. Si algo falla, devuelve campos vacíos
// y el link se guarda igual.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const raw = new URL(request.url).searchParams.get("url")?.trim();
  if (!raw) return NextResponse.json({ error: "Falta el link." }, { status: 400 });

  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  }

  const out: Preview = { platform: "otro", title: null, thumbnail_url: null, url: u.toString() };

  if (YT_HOSTS.includes(u.hostname)) {
    out.platform = "youtube";
    const id = youtubeId(u);
    if (id) {
      out.thumbnail_url = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      const data = await fetchJson(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u.toString())}`
      );
      if (typeof data?.title === "string") out.title = data.title;
    }
  } else if (TT_HOSTS.includes(u.hostname)) {
    out.platform = "tiktok";
    // Los links cortos (vm./vt.) se resuelven primero a la URL final del video.
    let target = u.toString();
    if (u.hostname.startsWith("vm.") || u.hostname.startsWith("vt.")) {
      try {
        const res = await fetch(target, {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(6000),
        });
        const final = new URL(res.url);
        if (TT_HOSTS.includes(final.hostname)) {
          target = final.toString();
          out.url = target;
        }
      } catch {
        // se intenta oEmbed con el link original
      }
    }
    const data = await fetchJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`);
    if (typeof data?.title === "string") out.title = data.title;
    let image = typeof data?.thumbnail_url === "string" ? data.thumbnail_url : null;
    if (!image || !out.title) {
      const og = await fetchOpenGraph(target);
      image = image ?? og.image;
      out.title = out.title ?? og.title;
    }
    if (image) out.thumbnail_url = await toDataUrl(image);
  } else if (IG_HOSTS.includes(u.hostname)) {
    // Sin API de Meta: se lee la vista previa Open Graph de la página pública.
    out.platform = "instagram";
    const og = await fetchOpenGraph(u.toString());
    out.title = og.title;
    if (og.image) out.thumbnail_url = await toDataUrl(og.image);
  }

  return NextResponse.json(out);
}
