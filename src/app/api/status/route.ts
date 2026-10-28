import { NextResponse } from "next/server";
import { dataMode, llmLabel } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ mode: dataMode(), llm: llmLabel() });
}
