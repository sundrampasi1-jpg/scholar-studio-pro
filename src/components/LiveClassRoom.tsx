import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, CameraOff, Mic, MicOff, Radio, Wifi, WifiOff } from "lucide-react";
import { Room, RoomEvent, Track } from "livekit-client";
import { Button } from "@/components/ui/button";
import { getLiveClassToken } from "@/lib/live-class.functions";

export function LiveClassRoom({ liveClassId, mode }: { liveClassId: string; mode: "host" | "viewer" }) {
  const getToken = useServerFn(getLiveClassToken);
  const videoRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState("Connecting to live class…");
  const [connected, setConnected] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let room: Room | null = null;
    const attached: HTMLElement[] = [];

    async function connect() {
      try {
        const credentials = await getToken({ data: { liveClassId } });
        if (cancelled) return;
        room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (!videoRef.current) return;
          const element = track.attach();
          if (element instanceof HTMLVideoElement) {
            element.playsInline = true;
            element.autoplay = true;
            element.className = "h-full w-full rounded-xl bg-black object-contain";
          } else if (element instanceof HTMLAudioElement) {
            element.autoplay = true;
            element.style.display = "none";
          }
          videoRef.current.appendChild(element);
          attached.push(element);
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((element) => {
            element.remove();
            const index = attached.indexOf(element);
            if (index >= 0) attached.splice(index, 1);
          });
        });
        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled) {
            setConnected(false);
            setStatus("Connection ended.");
          }
        });

        await room.connect(credentials.serverUrl, credentials.participantToken);
        if (cancelled) return;
        setConnected(true);
        setStatus(mode === "host" ? "You are live. Students can watch now." : "Connected. Waiting for the teacher's video…");

        if (mode === "host") {
          await room.localParticipant.enableCameraAndMicrophone();
          if (cancelled || !videoRef.current) return;
          const camera = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
          if (camera) {
            const element = camera.attach();
            if (element instanceof HTMLVideoElement) element.playsInline = true;
            element.autoplay = true;
            element.className = "h-full w-full rounded-xl bg-black object-contain";
            videoRef.current.appendChild(element);
            attached.push(element);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Could not connect to the live class.");
          setConnected(false);
        }
      }
    }

    void connect();
    return () => {
      cancelled = true;
      attached.forEach((element) => element.remove());
      if (room) {
        room.removeAllListeners();
        void room.disconnect();
      }
      roomRef.current = null;
    };
  }, [liveClassId, mode, getToken]);

  async function toggleCamera() {
    const room = roomRef.current;
    if (!room) return;
    const next = !cameraOn;
    await room.localParticipant.setCameraEnabled(next);
    setCameraOn(next);
  }

  async function toggleMic() {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-slate-800 bg-slate-950 p-3 text-white shadow-lg">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-bold">
          <Radio className="h-4 w-4 text-red-400" /> {mode === "host" ? "Teacher live studio" : "Live classroom"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs">
          {connected ? <Wifi className="h-3.5 w-3.5 text-emerald-400" /> : <WifiOff className="h-3.5 w-3.5 text-amber-300" />}
          {connected ? "Connected" : "Connecting"}
        </span>
      </div>
      <div ref={videoRef} className="flex aspect-video min-h-40 items-center justify-center overflow-hidden rounded-xl bg-black">
        {!connected && <p className="px-4 text-center text-sm text-white/70">{status}</p>}
      </div>
      <p className="mt-2 text-xs text-white/70">{status}</p>
      {mode === "host" && connected && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant={cameraOn ? "secondary" : "destructive"} onClick={() => void toggleCamera()}>
            {cameraOn ? <Camera className="mr-1.5 h-4 w-4" /> : <CameraOff className="mr-1.5 h-4 w-4" />}
            {cameraOn ? "Camera on" : "Camera off"}
          </Button>
          <Button size="sm" variant={micOn ? "secondary" : "destructive"} onClick={() => void toggleMic()}>
            {micOn ? <Mic className="mr-1.5 h-4 w-4" /> : <MicOff className="mr-1.5 h-4 w-4" />}
            {micOn ? "Mic on" : "Mic off"}
          </Button>
        </div>
      )}
    </section>
  );
}
