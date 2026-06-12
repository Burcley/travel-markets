import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { error } = await supabase
      .from("support_tickets")
      .insert({
        name: body.name,
        email: body.email,
        category: body.category,
        subject: body.subject,
        message: body.message,
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 }
    );
  }
}