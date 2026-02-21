import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Read redirect target from cookie (set by the login page)
  const redirectTo = request.cookies.get("auth_redirect_to")?.value ?? "/dashboard";

  if (code) {
    // Collect cookies that Supabase sets during the exchange
    const cookiesToApply: { name: string; value: string; options: Record<string, unknown> }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookies) {
            cookiesToApply.push(
              ...cookies.map(({ name, value, options }) => ({
                name,
                value,
                options: options as Record<string, unknown>,
              }))
            );
            // Also update the request cookies so subsequent reads see the new values
            cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user has a profile (first-time users need to set a display name)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let destination = redirectTo;

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .single();

        if (!profile) {
          destination = "/setup";
        }
      }

      const response = NextResponse.redirect(new URL(destination, origin));

      // Apply auth cookies to the response
      for (const { name, value, options } of cookiesToApply) {
        response.cookies.set(name, value, options);
      }

      // Clear the redirect cookie
      response.cookies.set("auth_redirect_to", "", { path: "/", maxAge: 0 });

      return response;
    }
  }

  // No code or exchange failed — redirect to login
  return NextResponse.redirect(new URL("/login", origin));
}
