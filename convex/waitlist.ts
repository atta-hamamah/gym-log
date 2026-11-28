import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

/**
 * Pre-launch waitlist for the landing page (see the /waitlist/* routes in http.ts).
 *
 * Everyone gets a sequential spot when they join. Each friend who joins with your
 * referral link moves you up SPOTS_PER_REFERRAL spots. The spot is computed from
 * two stored numbers, so joining and reading stay O(1) however long the list gets.
 */
export const SPOTS_PER_REFERRAL = 5;

export const platformValidator = v.union(v.literal("android"), v.literal("ios"));

// No 0/O/1/I so codes survive being read aloud or typed from a screenshot.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 7;

function makeCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function summarize(entry: Doc<"waitlist">, total: number, alreadyJoined: boolean) {
  return {
    position: Math.max(1, entry.joinNumber - entry.referralCount * SPOTS_PER_REFERRAL),
    joinNumber: entry.joinNumber,
    referralCode: entry.referralCode,
    referralCount: entry.referralCount,
    spotsPerReferral: SPOTS_PER_REFERRAL,
    total,
    alreadyJoined,
  };
}

export const join = internalMutation({
  args: {
    email: v.string(),
    platform: platformValidator,
    locale: v.string(),
    ref: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const meta = await ctx.db.query("waitlistMeta").first();
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (existing) return summarize(existing, meta?.total ?? existing.joinNumber, true);

    const total = (meta?.total ?? 0) + 1;
    if (meta) await ctx.db.patch(meta._id, { total });
    else await ctx.db.insert("waitlistMeta", { total });

    let referralCode = makeCode();
    while (
      await ctx.db
        .query("waitlist")
        .withIndex("by_referralCode", (q) => q.eq("referralCode", referralCode))
        .unique()
    ) {
      referralCode = makeCode();
    }

    let referredBy: string | undefined;
    if (args.ref) {
      const referrer = await ctx.db
        .query("waitlist")
        .withIndex("by_referralCode", (q) => q.eq("referralCode", args.ref!))
        .unique();
      if (referrer) {
        referredBy = referrer.referralCode;
        await ctx.db.patch(referrer._id, { referralCount: referrer.referralCount + 1 });
      }
    }

    const id = await ctx.db.insert("waitlist", {
      email: args.email,
      platform: args.platform,
      locale: args.locale,
      referralCode,
      referredBy,
      referralCount: 0,
      joinNumber: total,
      source: args.source,
      createdAt: Date.now(),
    });
    const entry = (await ctx.db.get(id))!;
    if (process.env.WAITLIST_SITE_URL) {
      await ctx.scheduler.runAfter(0, internal.waitlist.sendWelcome, {
        email: args.email,
        locale: args.locale,
        referralCode,
        position: summarize(entry, total, false).position,
      });
    }
    return summarize(entry, total, false);
  },
});

// ── Welcome email ────────────────────────────────────────
// Sent through the same Resend account as sign-in codes (RESEND_API_KEY,
// AUTH_EMAIL_FROM). Off until WAITLIST_SITE_URL is set, e.g. "https://repai.shop".

const WELCOME: Record<string, { subject: string; hi: string; spot: string; share: string; perk: string; dir: "ltr" | "rtl" }> = {
  en: {
    subject: "You're on the RepAI list 💪",
    hi: "You're in. We'll email you the moment RepAI launches.",
    spot: "Your spot in line",
    share: "Want in sooner? Share your link. Every friend who joins moves you up {n} spots.",
    perk: "Your link",
    dir: "ltr",
  },
  ar: {
    subject: "أنت على قائمة RepAI 💪",
    hi: "تم تسجيلك. سنراسلك فور إطلاق RepAI.",
    spot: "ترتيبك في القائمة",
    share: "تريد الوصول أسرع؟ شارك رابطك. كل صديق ينضم يقدّمك {n} مراكز.",
    perk: "رابطك",
    dir: "rtl",
  },
  fr: {
    subject: "Vous êtes sur la liste RepAI 💪",
    hi: "C'est fait. On vous écrit dès le lancement de RepAI.",
    spot: "Votre place dans la file",
    share: "Envie d'y accéder plus tôt ? Partagez votre lien. Chaque ami inscrit vous fait gagner {n} places.",
    perk: "Votre lien",
    dir: "ltr",
  },
  es: {
    subject: "Estás en la lista de RepAI 💪",
    hi: "Ya estás dentro. Te escribiremos en cuanto RepAI se lance.",
    spot: "Tu puesto en la fila",
    share: "¿Lo quieres antes? Comparte tu enlace. Cada amigo que se una te sube {n} puestos.",
    perk: "Tu enlace",
    dir: "ltr",
  },
  hi: {
    subject: "आप RepAI की लिस्ट में हैं 💪",
    hi: "आप जुड़ गए। RepAI लॉन्च होते ही हम आपको ईमेल करेंगे।",
    spot: "लाइन में आपकी जगह",
    share: "जल्दी चाहिए? अपना लिंक शेयर करें। हर दोस्त के जुड़ने पर आप {n} जगह आगे बढ़ेंगे।",
    perk: "आपका लिंक",
    dir: "ltr",
  },
};

export const sendWelcome = internalAction({
  args: { email: v.string(), locale: v.string(), referralCode: v.string(), position: v.float64() },
  handler: async (_ctx, { email, locale, referralCode, position }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.AUTH_EMAIL_FROM;
    const site = process.env.WAITLIST_SITE_URL?.replace(/\/$/, "");
    if (!apiKey || !from || !site) return;

    const t = WELCOME[locale] ?? WELCOME.en;
    const link = `${site}/${WELCOME[locale] ? locale : "en"}?ref=${referralCode}`;
    const share = t.share.replace("{n}", String(SPOTS_PER_REFERRAL));
    const html = `<!doctype html>
<html dir="${t.dir}">
  <body style="margin:0;padding:24px;background:#0B0F1A;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#EEF1F8;">
    <div style="max-width:460px;margin:0 auto;background:#131828;border:1px solid #262E45;border-radius:20px;padding:32px;">
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;">Rep<span style="color:#4FB8FF;">AI</span></p>
      <p style="margin:0 0 24px;font-size:16px;color:#A3ABC2;">${t.hi}</p>
      <p style="margin:0;font-size:13px;color:#77809B;text-transform:uppercase;letter-spacing:1px;">${t.spot}</p>
      <p style="margin:0 0 24px;font-size:44px;font-weight:800;color:#FFA94D;">#${position.toLocaleString("en-US")}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#A3ABC2;">${share}</p>
      <p style="margin:0 0 6px;font-size:13px;color:#77809B;">${t.perk}</p>
      <a href="${link}" style="display:block;padding:14px 16px;background:#1A2033;border-radius:12px;color:#4FB8FF;font-size:15px;text-decoration:none;word-break:break-all;">${link}</a>
    </div>
  </body>
</html>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: t.subject,
        text: `${t.hi}\n\n${t.spot}: #${position}\n\n${share}\n${link}`,
        html,
      }),
    });
    if (!response.ok) {
      console.error("[waitlist] Resend returned", response.status, await response.text());
    }
  },
});

export const status = internalQuery({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const entry = await ctx.db
      .query("waitlist")
      .withIndex("by_referralCode", (q) => q.eq("referralCode", code))
      .unique();
    if (!entry) return null;
    const meta = await ctx.db.query("waitlistMeta").first();
    return summarize(entry, meta?.total ?? entry.joinNumber, true);
  },
});

export const stats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const meta = await ctx.db.query("waitlistMeta").first();
    return { total: meta?.total ?? 0 };
  },
});
