import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Heart, MessageCircle, Send, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/reels")({
  head: () => ({
    meta: [
      { title: "Reels — JK Academy" },
      { name: "description", content: "Short study videos from JK Academy." },
      { property: "og:title", content: "Reels — JK Academy" },
      { property: "og:description", content: "Short study videos from JK Academy." },
    ],
  }),
  component: ReelsPage,
});

function ReelsPage() {
  const { user } = useAuth();
  const reels = useQuery({
    queryKey: ["reels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reels")
        .select("*, reel_likes(user_id), reel_comments(count)")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="fixed inset-0 z-40 bg-foreground">
      <Link to="/dashboard" aria-label="Back" className="absolute left-3 top-3 z-50 rounded-full bg-background/20 p-2 text-background">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="h-full snap-y snap-mandatory overflow-y-scroll">
        {reels.isLoading && <p className="pt-40 text-center text-background/70">Loading…</p>}
        {reels.error && <p className="pt-40 text-center text-background/70">Could not load reels. <button className="underline" onClick={() => reels.refetch()}>Retry</button></p>}
        {reels.data?.length === 0 && <p className="pt-40 text-center text-background/70">No reels yet.</p>}
        {reels.data?.map((r) => (
          <Reel key={r.id} reel={r} userId={user?.id ?? ""} />
        ))}
      </div>
    </div>
  );
}

type ReelRow = {
  id: string;
  title: string;
  video_url: string;
  reel_likes: { user_id: string }[];
  reel_comments: { count: number }[];
};

function Reel({ reel, userId }: { reel: ReelRow; userId: string }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLVideoElement>(null);
  const [showComments, setShowComments] = useState(false);
  const liked = reel.reel_likes.some((l) => l.user_id === userId);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.6 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  async function toggleLike() {
    const q = liked
      ? supabase.from("reel_likes").delete().eq("reel_id", reel.id).eq("user_id", userId)
      : supabase.from("reel_likes").insert({ reel_id: reel.id, user_id: userId });
    const { error } = await q;
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["reels"] });
  }

  async function share() {
    const url = `${window.location.origin}/reels`;
    try {
      if (navigator.share) await navigator.share({ title: reel.title || "JK Academy reel", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user closed share sheet */
    }
  }

  return (
    <section className="relative flex h-full w-full snap-start items-center justify-center">
      <video
        ref={ref}
        src={reel.video_url}
        className="h-full w-full object-contain"
        loop
        playsInline
        preload="metadata"
        onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause())}
      />
      <div className="absolute bottom-24 right-3 flex flex-col items-center gap-5 text-background">
        <button onClick={toggleLike} aria-label="Like" className="flex flex-col items-center text-xs">
          <Heart className={`h-7 w-7 ${liked ? "fill-primary text-primary" : ""}`} />
          {reel.reel_likes.length}
        </button>
        <button onClick={() => setShowComments(true)} aria-label="Comments" className="flex flex-col items-center text-xs">
          <MessageCircle className="h-7 w-7" />
          {reel.reel_comments[0]?.count ?? 0}
        </button>
        <button onClick={share} aria-label="Share" className="flex flex-col items-center text-xs">
          <Share2 className="h-7 w-7" />
          Share
        </button>
      </div>
      {reel.title && <p className="absolute bottom-8 left-4 right-16 text-sm font-medium text-background">{reel.title}</p>}
      {showComments && <Comments reelId={reel.id} userId={userId} onClose={() => setShowComments(false)} />}
    </section>
  );
}

function Comments({ reelId, userId, onClose }: { reelId: string; userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [text, setText] = useState("");
  const list = useQuery({
    queryKey: ["reel-comments", reelId],
    queryFn: async () => {
      const { data, error } = await supabase.from("reel_comments").select("*").eq("reel_id", reelId).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  async function send() {
    const body = text.trim();
    if (!body) return;
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    const { error } = await supabase.from("reel_comments").insert({ reel_id: reelId, user_id: userId, body, author_name: prof?.full_name || "Student" });
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    qc.invalidateQueries({ queryKey: ["reel-comments", reelId] });
    qc.invalidateQueries({ queryKey: ["reels"] });
  }

  async function remove(id: string) {
    await supabase.from("reel_comments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["reel-comments", reelId] });
    qc.invalidateQueries({ queryKey: ["reels"] });
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-50 flex max-h-[65%] flex-col rounded-t-2xl bg-background text-foreground">
      <div className="flex items-center justify-between border-b p-3">
        <p className="font-semibold">Comments</p>
        <button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {list.data?.length === 0 && <p className="text-muted-foreground">Be the first to comment.</p>}
        {list.data?.map((c) => (
          <div key={c.id} className="flex justify-between gap-2">
            <p><span className="font-medium">{c.author_name}</span> {c.body}</p>
            {(c.user_id === userId || isAdmin) && <button className="text-xs text-muted-foreground" onClick={() => remove(c.id)}>Delete</button>}
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t p-2">
        <Input value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" onKeyDown={(e) => e.key === "Enter" && send()} />
        <button onClick={send} aria-label="Send" className="rounded-md bg-primary px-3 text-primary-foreground"><Send className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
