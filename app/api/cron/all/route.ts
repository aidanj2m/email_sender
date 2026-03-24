import { verifyCronRequest, runCronBatch, isCronActive } from "@/lib/cron";
import { AidanTemplate } from "@/email-templates/AidanTemplate";
import { AyanTemplate } from "@/email-templates/AyanTemplate";

export const runtime = "nodejs";
export const maxDuration = 60;

const DECK_URL = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/buzzed-tech-deck.pdf`;

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isCronActive())) {
    return Response.json({ skipped: true, reason: "Cron is inactive" });
  }

  const attachments = DECK_URL.startsWith("http")
    ? [{ filename: "Buzzed Tech Concise Deck.pdf", path: DECK_URL }]
    : undefined;

  const results: Record<string, unknown> = {};

  try {
    results.aidan = await runCronBatch({
      fromName: process.env.AIDAN_FROM_NAME ?? "Aidan McKenzie",
      fromEmail: process.env.AIDAN_FROM_EMAIL!,
      subject: process.env.AIDAN_SUBJECT ?? "Quick hello",
      attachments,
      buildHtml: AidanTemplate,
    });
  } catch (err) {
    results.aidan = { error: err instanceof Error ? err.message : "Unknown error" };
  }

  try {
    results.ayan = await runCronBatch({
      fromName: process.env.AYAN_FROM_NAME ?? "Ayan Khanna",
      fromEmail: process.env.AYAN_FROM_EMAIL!,
      subject: process.env.AYAN_SUBJECT ?? "Quick hello",
      attachments,
      buildHtml: AyanTemplate,
    });
  } catch (err) {
    results.ayan = { error: err instanceof Error ? err.message : "Unknown error" };
  }

  console.log("[cron/all]", JSON.stringify(results));
  return Response.json(results);
}
