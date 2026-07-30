import type { WebsiteManifest } from "@/lib/rendering/types";
import { Link } from "@tanstack/react-router";

function rt(
  field: { desktop: string; mobile: string } | undefined,
  fallback: string,
): { desktop: string; mobile: string } {
  return field ?? { desktop: fallback, mobile: fallback };
}

function Rtf({ field, fallback }: { field: { desktop: string; mobile: string } | undefined; fallback: string }) {
  const f = rt(field, fallback);
  return (
    <>
      <span className="hidden md:inline" style={{ whiteSpace: "pre-line" }}>{f.desktop}</span>
      <span className="inline md:hidden" style={{ whiteSpace: "pre-line" }}>{f.mobile}</span>
    </>
  );
}

export function TenantGateway({ manifest }: { manifest: WebsiteManifest }) {
  const { theme, bank, brand } = manifest;
  const hc = manifest.homepage_content?.gateway;

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

        <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/$slug/login"
            params={{ slug: bank.slug }}
            className="inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: theme.colors.accent }}
          >
            Customer Login
          </Link>
          <Link
            to="/$slug/register"
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

        <h1
          className="mt-10 text-3xl font-bold leading-tight sm:text-4xl"
          style={{
            fontFamily: theme.typography.heading,
            color: theme.colors.primary,
          }}
        >
          <Rtf field={hc?.heading} fallback="Banking that keeps up with your day." />
        </h1>

        <p className="mt-5 max-w-sm text-base opacity-80">
          <Rtf
            field={hc?.subtitle}
            fallback={`Open a ${bank.name} account in minutes. Instant transfers, real-time notifications and a portal designed around your money — not paperwork.`}
          />
        </p>
      </div>
    </div>
  );
}
