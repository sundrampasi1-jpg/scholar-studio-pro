import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

/** Uploads a file to the private media bucket and returns a long-lived access URL. */
export async function uploadMedia(file: File | Blob, folder: string, filename?: string) {
  const name =
    filename ??
    (file instanceof File ? file.name : `recording-${Date.now()}.webm`).replace(/[^\w.-]+/g, "_");
  const path = `${folder}/${Date.now()}-${name}`;
  const { error } = await supabase.storage.from("media").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage
    .from("media")
    .createSignedUrl(path, TEN_YEARS);
  if (signErr || !data) throw signErr ?? new Error("Could not create file link");
  return data.signedUrl;
}
