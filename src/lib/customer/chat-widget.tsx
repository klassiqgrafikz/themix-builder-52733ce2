// Renders the currently configured global chat widget for a tenant portal.
// Providers with script widgets (Tawk/Crisp/Smartsupp) inject their script tag
// into <head>; providers without an in-page widget (WhatsApp/Telegram) render
// a deep-link button.
import { useEffect } from "react";
import type { PlatformSupportConfig } from "./support.functions";
import { MessageCircle, Send } from "lucide-react";

declare global {
  interface Window {
    Tawk_API?: unknown;
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
    _smartsupp?: { key?: string };
    smartsupp?: (...args: unknown[]) => void;
  }
}

export function ChatWidget({
  config,
  primary,
}: {
  config: PlatformSupportConfig;
  primary: string;
}) {
  useEffect(() => {
    if (!config.live_chat_enabled) return;
    const provider = config.chat_provider;
    const c = config.chat_config;
    let injected: HTMLScriptElement | null = null;
    if (provider === "tawk" && c.tawk_property_id && c.tawk_widget_id) {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://embed.tawk.to/${c.tawk_property_id}/${c.tawk_widget_id}`;
      s.charset = "UTF-8";
      s.setAttribute("crossorigin", "*");
      document.head.appendChild(s);
      injected = s;
    } else if (provider === "crisp" && c.crisp_website_id) {
      window.$crisp = [];
      window.CRISP_WEBSITE_ID = c.crisp_website_id;
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://client.crisp.chat/l.js";
      document.head.appendChild(s);
      injected = s;
    } else if (provider === "smartsupp" && c.smartsupp_api_key) {
      window._smartsupp = { key: c.smartsupp_api_key };
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://www.smartsuppchat.com/loader.js?";
      document.head.appendChild(s);
      injected = s;
    }
    return () => {
      if (injected && injected.parentNode) injected.parentNode.removeChild(injected);
    };
  }, [config]);

  if (!config.live_chat_enabled || config.chat_provider === "none") return null;

  if (config.chat_provider === "whatsapp") {
    const num = (config.chat_config.whatsapp_number ?? "").replace(/[^\d]/g, "");
    const greeting = encodeURIComponent(config.chat_config.whatsapp_greeting ?? "Hello, I need help.");
    const href =
      config.chat_config.whatsapp_link ||
      (num ? `https://wa.me/${num}?text=${greeting}` : "");
    if (!href) return null;
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm"
        style={{ backgroundColor: "#25D366" }}
      >
        <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
      </a>
    );
  }

  if (config.chat_provider === "telegram") {
    const href = config.chat_config.telegram_group_link || "";
    if (!href) return null;
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm"
        style={{ backgroundColor: "#229ED9" }}
      >
        <Send className="h-4 w-4" /> Chat on Telegram
      </a>
    );
  }

  // Widget providers render their own floating button; give the customer a hint.
  return (
    <span
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
      style={{ backgroundColor: `${primary}18`, color: primary }}
    >
      <MessageCircle className="h-4 w-4" /> Live chat is available in the corner of your screen
    </span>
  );
}
