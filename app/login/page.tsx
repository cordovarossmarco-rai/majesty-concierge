import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/admin", error } = await searchParams;

  async function signIn(formData: FormData) {
    "use server";
    const password = String(formData.get("password") ?? "");
    const target = String(formData.get("next") ?? "/admin");

    if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
      redirect(`/login?next=${encodeURIComponent(target)}&error=1`);
    }

    (await cookies()).set("majesty_admin", password, {
      httpOnly: true,
      sameSite: "lax",
      // Sent over plain http in local development, and only over https once hosted.
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    redirect(target);
  }

  return (
    <main className="mx-auto w-full max-w-sm px-5 py-24">
      <h1 className="font-display text-3xl font-light">Staff sign in</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
        Enter the staff password to see the enquiries.
      </p>

      <form action={signIn} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="off"
            autoFocus
            className="w-full border border-line bg-paper-raised px-3 py-2.5 text-[15px] transition-colors focus:border-line-strong"
          />
        </div>

        {error && (
          <p role="alert" className="border border-line-strong px-3 py-2 text-[14px]">
            That password was not right.
          </p>
        )}

        <button
          type="submit"
          className="w-full bg-accent px-6 py-3 text-[15px] font-medium text-paper-raised transition-all hover:bg-accent-hover active:translate-y-px"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
