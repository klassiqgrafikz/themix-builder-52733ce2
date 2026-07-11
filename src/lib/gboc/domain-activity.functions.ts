// Server functions for the Domain Setup Wizard:
//   * listDomainActivity — reads the audit trail for a bank's domain.
//   * detectDnsProvider  — best-effort DNS-provider detection via NS lookup.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withPlatformServiceRole } from "@/integrations/supabase/platform-service-middleware";

export type DomainActivityEntry = {
  id: string;
  bank_id: string;
  domain: string | null;
  action: string;
  result: string;
  message: string | null;
  actor_id: string | null;
  created_at: string;
};

export const listDomainActivity = createServerFn({ method: "GET" })
  .middleware([withPlatformServiceRole])
  .inputValidator((d: { bank_id: string; limit?: number }) =>
    z
      .object({
        bank_id: z.string().uuid(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<DomainActivityEntry[]> => {
    const { data: rows, error } = await context.supabase
      .from("bank_domain_activity")
      .select("*")
      .eq("bank_id", data.bank_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return (rows ?? []) as DomainActivityEntry[];
  });

// --- Provider detection -----------------------------------------------------
export type DnsProvider = {
  id: string;
  name: string;
  nameservers: string[];
  instructions: { title: string; steps: string[] };
};

const PROVIDERS: Array<{
  id: string;
  name: string;
  match: RegExp;
  steps: string[];
}> = [
  {
    id: "cloudflare",
    name: "Cloudflare",
    match: /cloudflare\.com$/i,
    steps: [
      "Open Cloudflare dashboard and select the domain.",
      "Go to DNS → Records.",
      "Click Add record and add the records shown below.",
      "IMPORTANT: Set the Proxy status to DNS only (grey cloud) until verification completes.",
      "Save each record. Return here and click Verify Domain.",
    ],
  },
  {
    id: "namecheap",
    name: "Namecheap",
    match: /registrar-servers\.com$|namecheaphosting\.com$/i,
    steps: [
      "Log in to Namecheap.",
      "Go to Domain List → Manage next to your domain.",
      "Open the Advanced DNS tab.",
      "Under Host Records → Add New Record, add each record below.",
      "Save all changes and return here to click Verify Domain.",
    ],
  },
  {
    id: "godaddy",
    name: "GoDaddy",
    match: /domaincontrol\.com$/i,
    steps: [
      "Log in to GoDaddy and open My Products.",
      "Next to your domain click DNS.",
      "Under Records click Add.",
      "Add each of the records shown below.",
      "Save and return here to click Verify Domain.",
    ],
  },
  {
    id: "hostinger",
    name: "Hostinger",
    match: /dns-parking\.com$|hostinger\.com$/i,
    steps: [
      "Open hPanel → Domains → your domain.",
      "Select DNS / Nameservers.",
      "Under Manage DNS records add each record below.",
      "Save and return here to Verify.",
    ],
  },
  {
    id: "porkbun",
    name: "Porkbun",
    match: /porkbun\.com$/i,
    steps: [
      "Log in to Porkbun and open Domain Management.",
      "Click DNS next to your domain.",
      "Add each record below using the Add form.",
      "Save and return here to Verify.",
    ],
  },
  {
    id: "ionos",
    name: "IONOS",
    match: /ui-dns\.(?:com|org|de|biz)$/i,
    steps: [
      "Open IONOS control panel → Domains & SSL.",
      "Select the domain and click DNS.",
      "Click Add record and enter each record below.",
      "Save and return here to Verify.",
    ],
  },
  {
    id: "squarespace",
    name: "Squarespace / Google Domains",
    match: /(squarespacedns|googledomains)\.com$/i,
    steps: [
      "Open Squarespace → Settings → Domains → your domain.",
      "Choose DNS settings.",
      "Under Custom Records add each record below.",
      "Save and return here to Verify.",
    ],
  },
  {
    id: "wix",
    name: "Wix",
    match: /wixdns\.net$/i,
    steps: [
      "Open Wix → Domains → your domain → Advanced.",
      "Click Edit DNS.",
      "Add each record shown below in the correct section.",
      "Save and return here to Verify.",
    ],
  },
  {
    id: "digitalocean",
    name: "DigitalOcean",
    match: /digitalocean\.com$/i,
    steps: [
      "Open DigitalOcean → Networking → Domains.",
      "Select the domain and add each record below.",
      "Save and return here to Verify.",
    ],
  },
  {
    id: "route53",
    name: "AWS Route 53",
    match: /awsdns-\d+\.(?:com|net|org|co\.uk)$/i,
    steps: [
      "Open Route 53 → Hosted zones → your zone.",
      "Click Create record for each row below.",
      "Save and return here to Verify.",
    ],
  },
  {
    id: "google-cloud-dns",
    name: "Google Cloud DNS",
    match: /googledomains\.com$|(?:cloud-dns|google)\.com$/i,
    steps: [
      "Open Google Cloud Console → Network Services → Cloud DNS.",
      "Open your zone and click Add Standard.",
      "Add each record below and save.",
      "Return here to Verify.",
    ],
  },
  {
    id: "azure",
    name: "Azure DNS",
    match: /azure-dns\.(?:com|net|org|info)$/i,
    steps: [
      "Open Azure Portal → DNS zones → your zone.",
      "Click Record set and add each record below.",
      "Save and return here to Verify.",
    ],
  },
];

type DohNsAnswer = { name: string; type: number; TTL: number; data: string };

export const detectDnsProvider = createServerFn({ method: "POST" })
  .middleware([withPlatformServiceRole])
  .inputValidator((d: { domain: string }) =>
    z.object({ domain: z.string().trim().toLowerCase().min(3) }).parse(d),
  )
  .handler(async ({ data }): Promise<DnsProvider> => {
    const bare = data.domain
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .trim();

    // Look up NS for both the input and its apex (labels.length - 2..).
    const labels = bare.split(".");
    const apex = labels.length > 2 ? labels.slice(-2).join(".") : bare;

    const queries = Array.from(new Set([bare, apex]));
    let nameservers: string[] = [];
    for (const name of queries) {
      try {
        const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=NS&_=${Date.now()}`;
        const res = await fetch(url, { headers: { Accept: "application/dns-json" } });
        if (!res.ok) continue;
        const body = (await res.json()) as { Status: number; Answer?: DohNsAnswer[] };
        if (body.Status !== 0 || !body.Answer) continue;
        const found = body.Answer.filter((a) => a.type === 2).map((a) =>
          a.data.replace(/\.$/, "").toLowerCase(),
        );
        if (found.length) {
          nameservers = found;
          break;
        }
      } catch {
        // ignore, try next
      }
    }

    for (const p of PROVIDERS) {
      if (nameservers.some((ns) => p.match.test(ns))) {
        return {
          id: p.id,
          name: p.name,
          nameservers,
          instructions: { title: `${p.name} — DNS setup`, steps: p.steps },
        };
      }
    }
    return {
      id: "unknown",
      name: "Unknown Provider",
      nameservers,
      instructions: {
        title: "Generic DNS setup",
        steps: [
          "Log in to your domain registrar or DNS provider.",
          "Find the DNS / Nameservers / Records section for this domain.",
          "Add each of the records shown below exactly as displayed.",
          "Save your changes and return here to click Verify Domain.",
        ],
      },
    };
  });
