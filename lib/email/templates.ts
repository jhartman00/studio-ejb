// CAN-SPAM compliance: every campaign email must include the studio's
// physical postal address and a working unsubscribe mechanism.

export function isPlaceholderAddress(s: string | undefined | null): boolean {
  if (!s) return true;
  const t = s.trim().toLowerCase();
  if (t.length < 8) return true;
  if (t.includes("placeholder")) return true;
  if (t.includes("update before")) return true;
  if (t === "tbd" || t === "todo") return true;
  return false;
}

export function unsubscribeUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://studioejb.vercel.app";
  return `${base}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function oneClickUnsubscribeUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://studioejb.vercel.app";
  return `${base}/api/unsubscribe/one-click?token=${encodeURIComponent(token)}`;
}

// Returns the HTML footer block appended to every campaign body. Uses
// inline styles because email clients ignore <style> blocks.
export function campaignFooterHtml(opts: {
  studioMailingAddress: string;
  unsubscribeUrl: string;
}): string {
  const safeAddr = String(opts.studioMailingAddress).replace(/[<>]/g, "");
  return `
    <hr style="border:0;border-top:1px solid #2b2620;opacity:0.16;margin:32px 0 16px;" />
    <p style="font-size:13px;color:#5a4f44;line-height:1.5;margin:0 0 8px;">
      Studio EJB. ${safeAddr}.
    </p>
    <p style="font-size:13px;color:#5a4f44;line-height:1.5;margin:0;">
      You are getting this because you signed up at studioejb.vercel.app.
      <a href="${opts.unsubscribeUrl}" style="color:#6f5638;">Unsubscribe</a>.
    </p>
  `;
}

export function campaignFooterText(opts: {
  studioMailingAddress: string;
  unsubscribeUrl: string;
}): string {
  return `\n\n---\nStudio EJB. ${opts.studioMailingAddress}.\nYou are getting this because you signed up at studioejb.vercel.app.\nUnsubscribe: ${opts.unsubscribeUrl}`;
}
