// CORS headers for cross-origin requests from Capacitor Android app
// The APK runs on a custom origin (https://localhost) and needs CORS to reach the Vercel server

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleOptions(): Response {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(),
  });
}
