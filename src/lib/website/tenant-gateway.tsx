import type { WebsiteManifest } from "@/lib/rendering/types";
import { Link } from "@tanstack/react-router";

/**
 * Minimal public landing gateway for a generated tenant bank.
 *
 * Shows only the uploaded Login Page Logo, the two primary actions
 * (Customer Login / Open Account), and a short welcome message that
 * automatically inserts the generated bank's name.
 */
export function TenantGateway({ manifest }: { manifest: WebsiteManifest }) {
  const { theme, bank, brand } = manifest;

  const background = theme.dark_mode ? "#0b1120" : "#f8fafc";
  const foreground = theme.dark_mode ? "#f1f5f9" : "#0f172a";

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-6"
      style={{
        backgroundColor: background,
        color: foreground,
        fontFamily: theme.typography.body,
      }}
    >
      <div className="flex w-full max-w-md flex-col items-center text-center">
        {brand.login_logo_url ? (
          <img
            src={brand.login_logo_url}
            alt={`${bank.name} logo`}
            className="h-28 w-auto object-contain"
          />
        ) : (
          <div
            className="flex h-28 w-28 items-center justify-center rounded-3xl text-4xl font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
              fontFamily: theme.typography.heading,
            }}
          >
            {bank.name.slice(0, 1)}
          </div>
        )}

        <h1
          className="mt-10 text-3xl font-bold leading-tight sm:text-4xl"
          style={{
            fontFamily: theme.typography.heading,
            color: theme.colors.primary,
          }}
        >
          Banking that keeps up with your day.
        </h1>

        <p className="mt-5 text-base opacity-80">
          Open a {bank.name} account in minutes. Instant transfers, real-time
          notifications and a portal designed around your money — not paperwork.
        </p>

        <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/banks/$slug/login"
            params={{ slug: bank.slug }}
            className="inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: theme.colors.accent }}
          >
            Customer Login
          </Link>
          <Link
            to="/banks/$slug/register"
            params={{ slug: bank.slug }}
            className="inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              color: theme.colors.primary,
              border: `1px solid ${theme.colors.primary}33`,
            }}
          >
            Open Account
          </Link>
        </div>
      </div>
    </div>
  );
}
