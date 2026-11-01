import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AppSettings = Tables<"app_settings">;

export const defaultSettings = {
  app_name: "JK Academy",
  institute_name: "JK Academy",
  tagline: "Crack your exam with confident preparation",
  hero_title: "Learn smarter. Score higher.",
  hero_subtitle: "Live classes, structured courses, tests and doubt support in one app.",
} as const;

export const settingsQuery = {
  queryKey: ["app_settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("app_settings").select("*").maybeSingle();
    if (error) throw error;
    return data;
  },
  staleTime: 60_000,
};

/** Converts a stored color (hex, "0 72% 45%" hsl triple, or oklch) into a CSS color. */
function toCssColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith("#") || v.startsWith("oklch") || v.startsWith("hsl") || v.startsWith("rgb")) return v;
  if (/^[\d.]+\s+[\d.]+%\s+[\d.]+%$/.test(v)) return `hsl(${v})`;
  return v;
}

export function useBranding() {
  const { data, isLoading } = useQuery(settingsQuery);

  const primary = toCssColor(data?.primary_color);
  const secondary = toCssColor(data?.secondary_color);

  useEffect(() => {
    const root = document.documentElement;
    if (primary) {
      root.style.setProperty("--primary", primary);
      root.style.setProperty("--ring", primary);
      root.style.setProperty("--sidebar-primary", primary);
    }
    if (secondary) root.style.setProperty("--secondary-foreground", secondary);
  }, [primary, secondary]);

  useEffect(() => {
    if (!data?.favicon_url) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = data.favicon_url;
  }, [data?.favicon_url]);

  useEffect(() => {
    if (data?.app_name) document.title = data.app_name;
  }, [data?.app_name]);

  return {
    settings: data,
    isLoading,
    appName: data?.app_name || defaultSettings.app_name,
    instituteName: data?.institute_name || defaultSettings.institute_name,
    tagline: data?.tagline || defaultSettings.tagline,
    logoUrl: data?.logo_url || null,
    upiId: data?.upi_id || null,
  };
}
