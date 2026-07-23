export function youtubeEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (hostname === "youtu.be")
      id = url.pathname.slice(1).split("/")[0] ?? null;
    if (["youtube.com", "youtube-nocookie.com"].includes(hostname)) {
      id = url.pathname.startsWith("/embed/")
        ? (url.pathname.split("/")[2] ?? null)
        : url.searchParams.get("v");
    }
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id)
      ? `https://www.youtube-nocookie.com/embed/${id}`
      : null;
  } catch {
    return null;
  }
}
