import { verifyCronRequest, runCronBatch, isCronActive } from "@/lib/cron";
import { AyanTemplate } from "@/email-templates/AyanTemplate";

export const runtime = "nodejs";
export const maxDuration = 60;

const DECK_URL = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://yourdomain.com"}/buzzed-tech-deck.pdf`;

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isCronActive())) {
    return Response.json({ skipped: true, reason: "Cron is inactive" });
  }

  try {
    const result = await runCronBatch({
      fromName: process.env.AYAN_FROM_NAME ?? "Ayan",
      fromEmail: process.env.AYAN_FROM_EMAIL!,
      subject: process.env.AYAN_SUBJECT ?? "Quick hello",
      attachments: [
        { filename: "Buzzed Tech Concise Deck.pdf", path: DECK_URL },
      ],
      buildHtml: AyanTemplate,
    });

    console.log(`[cron/ayan] sent=${result.sent} remaining=${result.remaining} errors=${result.errors.length}`);
    return Response.json(result);
  } catch (err) {
    console.error("[cron/ayan]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
