import { NextRequest } from "next/server";
import { dbQuery, dbInsert } from "@/lib/supabase";

export async function GET(_req: NextRequest) {
  try {
    const contacts = await dbQuery("contacts", {
      select: "*",
      order: "created_at.desc",
    });
    return Response.json(contacts);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, tags } = body;

    if (!email || typeof email !== "string") {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return Response.json({ error: "Invalid email address" }, { status: 400 });
    }

    const [contact] = await dbInsert("contacts", {
      email: email.trim().toLowerCase(),
      name: name?.trim() || null,
      tags: tags || [],
    });

    return Response.json(contact, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return Response.json({ error: "Email already exists" }, { status: 409 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
