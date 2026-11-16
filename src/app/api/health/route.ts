import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "小組記帳與分帳 App",
    projectId: "ai-language-model-intergrition",
  });
}
