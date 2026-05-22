import { NextResponse } from "next/server";
import { corsHeaders } from '@/lib/cors';

export async function GET() {
  return NextResponse.json({ message: "InkaHobby Server", status: "ok" }, {
    headers: corsHeaders(),
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(),
  });
}
