
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  User, Camera, BookOpen, Wallet, FileText, FileQuestion, Radio,
  Bell, Settings, KeyRound, Phone, Shield, LogOut, Download,
  Play, Trash2, X, Maximize, Minimize,
} from "lucide-react";
import { StudentShell } from "@/components/StudentShell";
import { LoadingState } from "@/components/DataStates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/queries";
import { listDownloads, removeDownload, type DownloadEntry } from "@/lib/downloads";
import { getCachedMedia, deleteCachedMedia } from "@/lib/offline-media";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — JK Academy" },
      {
        name: "description",
        content: "Manage your JK Academy student profile, courses, payments and more.",
      },
    ],
  }),
  component: ProfilePage,
});

const statusClass: Record<string, string> = {
  paid: "bg-success/15 text-success",
  pending: "bg-warning/15 text-warning-foreground",
  failed: "bg-destructive/10 text-destructive",
};

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [downloads, setDownloads] = useState<DownloadEntry[]>([]);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [playingTitle, setPlayingTitle] = useState("");
  const [playingLessonId, setPlayingLessonId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const result = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data as any;
    },
  });

  const payments = useQuery({
    queryKey: ["my-payments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const result = await supabase
        .from("payments")
        .select("id, amount, status, provider_ref, created_at, course_id, courses(title)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (result.error) throw result.error;
      return result.data;
    },
  });

  const myCourses = (payments.data ?? []).filter(
    (p) => p.status === "paid" && p.course_id
  );

  useEffect(() => {
    if (profile.data) {
      setFullName(profile.data.full_name ?? "");
      setPhone(profile.data.phone ?? "");
    }
  }, [profile.data]);

  useEffect(() => {
    let cancelled = false;

    async function loadAvatar() {
      const path = profile.data?.avatar_url;
      if (!path) {
        setAvatarUrl(null);
        return;
      }
      if (path.startsWith("http")) {
        setAvatarUrl(path);
        return;
      }
      const result = await supabase.storage.from("media").createSignedUrl(path, 3600);
      if (!cancelled && result.data) setAvatarUrl(result.data.signedUrl);
    }

    loadAvatar();
    return () => {
      cancelled = true;
    };
  }, [profile.data?.avatar_url]);

  useEffect(() => {
    try {
      setDownloads(listDownloads());
    } catch {
      setDownloads([]);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (playingUrl) URL.revokeObjectURL(playingUrl);
    };
  }, [playingUrl]);

  useEffect(() => {
    if (!playingUrl) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = oldOverflow;
    };
  }, [playingUrl]);

  useEffect(() => {
    if (!playingUrl || !videoPlaying || !showControls) return;
    const timer = window.setTimeout(() => setShowControls(false), 3000);
    return () => window.clearTimeout(timer);
  }, [playingUrl, videoPlaying, showControls]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = document.fullscreenElement === playerRef.current;
      setFullscreen(active);
      if (!active) {
        try {
          void (screen.orientation as any)?.unlock?.();
        } catch {
          // Orientation unlock is not supported on every browser.
        }
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      if (fullName.trim().length < 2) throw new Error("Enter your full name.");
      const result = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() || null })
        .eq("id", user!.id);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = "avatars/" + user.id + "." + ext;
      const upResult = await supabase.storage.from("media").upload(path, file, { upsert: true });
      if (upResult.error) throw upResult.error;

      const dbResult = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", user.id);
      if (dbResult.error) throw dbResult.error;

      toast.success("Photo updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast.error(err.message ?? "Could not update photo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function resetPassword() {
    if (!user?.email) return;
    const result = await supabase.auth.resetPasswordForEmail(user.email);
    if (result.error) toast.error(result.error.message);
    else toast.success("Password reset link sent to your email");
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  async function openDownloadedVideo(item: DownloadEntry) {
    try {
      const blob = await getCachedMedia(item.lessonId);
      if (!blob || !blob.size) {
        toast.error("Video file is not available on this device.");
        return;
      }

      const url = URL.createObjectURL(blob);
      setPlayingTitle(item.title);
      setPlayingLessonId(item.lessonId);
      setShowControls(true);
      setPlayingUrl(url);
    } catch {
      toast.error("Could not open downloaded video.");
    }
  }

  async function deleteDownload(item: DownloadEntry) {
    try {
      await deleteCachedMedia(item.lessonId);
      removeDownload(item.key);
      setDownloads(listDownloads());

      if (playingLessonId === item.lessonId) closeVideo();
      toast.success("Download deleted.");
    } catch {
      toast.error("Could not delete download.");
    }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      const player = playerRef.current;
      if (!player) return;

      await player.requestFullscreen();

      try {
        await (screen.orientation as any)?.lock?.("landscape");
      } catch {
        // Some Android browsers/PWA modes do not allow orientation lock.
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
      toast.error("Fullscreen is not supported by this device.");
    }
  }

  function closeVideo() {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
    try {
      void (screen.orientation as any)?.unlock?.();
    } catch {
      // Ignore unsupported orientation unlock.
    }
    setFullscreen(false);
    setPlayingUrl(null);
    setVideoPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setShowControls(true);

    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    lastTapRef.current = null;

    setPlayingTitle("");
    setPlayingLessonId(null);
  }

  const studentId = user?.id ? user.id.slice(0, 8).toUpperCase() : "—";

  if (profile.isLoading) {
    return <StudentShell title="My profile"><LoadingState /></StudentShell>;
  }

  return (
    <StudentShell title="My profile">
      <div className="space-y-5">
        <div className="surface-card flex flex-wrap items-center gap-4 p-5">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary/10">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User className="h-9 w-9 text-primary" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
              aria-label="Change photo"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">{profile.data?.full_name || "Student"}</p>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground">Student ID: {studentId}</p>
          </div>

          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit profile"}
          </Button>
        </div>

        {editing && (
          <form
            className="surface-card space-y-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Gmail / Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pn">Full name</Label>
              <Input id="pn" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pp">Mobile number</Label>
              <Input id="pp" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" disabled={save.isPending}>Save changes</Button>
          </form>
        )}

        <section className="surface-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <BookOpen className="h-4 w-4 text-primary" /> My courses
          </h2>
          {myCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No purchased batches yet.</p>
          ) : (
            <ul className="divide-y">
              {myCourses.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <Link to="/courses/$courseId" params={{ courseId: p.course_id! }} className="text-sm font-medium hover:underline">
                    {p.courses?.title ?? "Course"}
                  </Link>
                  <span className="text-xs text-muted-foreground">{formatDateTime(p.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Wallet className="h-4 w-4 text-primary" /> My payments
          </h2>
          {!payments.data?.length ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <ul className="divide-y">
              {payments.data.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{p.courses?.title ?? "Course"}</span>
                  <span className="font-semibold">₹{Number(p.amount).toFixed(0)}</span>
                  <span className={"rounded-full px-2 py-0.5 text-xs font-medium capitalize " + (statusClass[p.status] ?? "bg-muted")}>
                    {p.status}
                  </span>
                  {p.provider_ref && <span className="w-full text-[10px] text-muted-foreground">Txn: {p.provider_ref}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Download className="h-4 w-4 text-primary" /> My downloads
          </h2>
          {downloads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No downloads yet on this device.</p>
          ) : (
            <ul className="divide-y">
              {downloads.map((item) => (
                <li key={item.lessonId} className="flex min-w-0 items-center gap-2 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(item.at)}</p>
                    {item.size > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {(item.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void openDownloadedVideo(item)}>
                    <Play className="mr-1 h-4 w-4" /> Play
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Delete download" onClick={() => void deleteDownload(item)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link to="/notes" className="surface-card flex flex-col items-center gap-2 p-4 text-center text-sm font-medium">
            <FileText className="h-5 w-5 text-primary" /> My PDFs and Notes
          </Link>
          <Link to="/tests" className="surface-card flex flex-col items-center gap-2 p-4 text-center text-sm font-medium">
            <FileQuestion className="h-5 w-5 text-primary" /> My tests
          </Link>
          <Link to="/live" className="surface-card flex flex-col items-center gap-2 p-4 text-center text-sm font-medium">
            <Radio className="h-5 w-5 text-primary" /> Live classes
          </Link>
          <Link to="/notifications" className="surface-card flex flex-col items-center gap-2 p-4 text-center text-sm font-medium">
            <Bell className="h-5 w-5 text-primary" /> Notifications
          </Link>
          <Link to="/help" className="surface-card flex flex-col items-center gap-2 p-4 text-center text-sm font-medium">
            <Phone className="h-5 w-5 text-primary" /> Help and support
          </Link>
          <button type="button" onClick={resetPassword} className="surface-card flex flex-col items-center gap-2 p-4 text-center text-sm font-medium">
            <KeyRound className="h-5 w-5 text-primary" /> Reset password
          </button>
        </section>

        <section className="surface-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Settings className="h-4 w-4 text-primary" /> Account
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={resetPassword}>
              <KeyRound className="mr-1.5 h-4 w-4" /> Change password
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/help"><Shield className="mr-1.5 h-4 w-4" /> Privacy and terms</Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={signOut}>
              <LogOut className="mr-1.5 h-4 w-4" /> Logout
            </Button>
          </div>
        </section>
      </div>

      {playingUrl && createPortal(
        <div
          ref={playerRef}
          className="fixed inset-0 z-[99999] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black"
          style={{ touchAction: "pan-x pan-y" }}
          onPointerUp={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest("button, input")) return;

            const now = Date.now();
            const x = e.clientX;
            const previous = lastTapRef.current;

            if (previous && now - previous.time < 280) {
              if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
              lastTapRef.current = null;

              const video = playerRef.current?.querySelector("video");
              if (video) {
                const rect = e.currentTarget.getBoundingClientRect();
                const forward = x >= rect.left + rect.width / 2;
                video.currentTime = Math.max(
                  0,
                  Math.min(video.duration || 0, video.currentTime + (forward ? 10 : -10))
                );
              }
              setShowControls(false);
              return;
            }

            lastTapRef.current = { time: now, x };
            if (tapTimerRef.current) clearTimeout(tapTimerRef.current);

            tapTimerRef.current = setTimeout(() => {
              setShowControls((visible) => !visible);
              lastTapRef.current = null;
            }, 280);
          }}
        >
          <video
            key={playingUrl}
            src={playingUrl}
            controls={false}
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
              setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0);
            }}
            onDurationChange={(e) => {
              setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0);
            }}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onPlay={() => {
              setVideoPlaying(true);
              setShowControls(false);
            }}
            onPause={() => {
              setVideoPlaying(false);
              setShowControls(true);
            }}
            className="h-full w-full object-contain"
          />

          {!videoPlaying && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const video = playerRef.current?.querySelector("video");
                if (video) void video.play();
              }}
              aria-label="Play video"
              className="absolute left-1/2 top-1/2 z-20 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white"
            >
              <Play className="ml-1 h-8 w-8 fill-white" />
            </button>
          )}

          {showControls && (
            <>
              <div
                className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between gap-3 bg-gradient-to-b from-black/90 to-transparent p-4 text-white"
                onPointerUp={(e) => e.stopPropagation()}
              >
                <p className="min-w-0 flex-1 truncate font-semibold">{playingTitle}</p>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void toggleFullscreen()}
                    aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    className="rounded-full bg-white/15 p-3"
                  >
                    {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={closeVideo}
                    aria-label="Close video"
                    className="rounded-full bg-white/15 p-3"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div
                className="absolute bottom-0 left-0 right-0 z-30 space-y-3 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pb-6 pt-12 text-white"
                style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
                onPointerUp={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 text-xs tabular-nums">
                  <span className="w-10 text-right">
                    {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, "0")}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 1}
                    step={0.1}
                    value={Math.min(currentTime, duration || 0)}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      const video = playerRef.current?.querySelector("video");
                      if (video) {
                        video.currentTime = next;
                        setCurrentTime(next);
                      }
                    }}
                    aria-label="Seek video"
                    className="h-2 min-w-0 flex-1 cursor-pointer accent-white"
                  />
                  <span className="w-10">
                    {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, "0")}
                  </span>
                </div>

                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      const video = playerRef.current?.querySelector("video");
                      if (!video) return;
                      if (video.paused) void video.play();
                      else video.pause();
                    }}
                    aria-label={videoPlaying ? "Pause video" : "Play video"}
                    className="rounded-full bg-white/20 p-3"
                  >
                    {videoPlaying ? <span className="px-1 text-xl">Ⅱ</span> : <Play className="h-6 w-6 fill-white" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </StudentShell>
  );
}
