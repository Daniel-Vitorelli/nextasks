import { cn } from "@/lib/utils";

const BLOCKS: {
  day: number;
  top: number;
  height: number;
  color: string;
}[] = [
  { day: 0, top: 8, height: 14, color: "bg-blue-500/80" },
  { day: 1, top: 30, height: 20, color: "bg-emerald-500/80" },
  { day: 1, top: 58, height: 12, color: "bg-purple-500/80" },
  { day: 2, top: 12, height: 16, color: "bg-amber-500/80" },
  { day: 3, top: 42, height: 18, color: "bg-rose-500/80" },
  { day: 3, top: 68, height: 12, color: "bg-sky-500/80" },
  { day: 4, top: 20, height: 16, color: "bg-emerald-500/80" },
  { day: 5, top: 10, height: 12, color: "bg-purple-500/80" },
  { day: 6, top: 50, height: 14, color: "bg-blue-500/80" },
];

/** Mock visual (CSS puro) da interface do aplicativo para o hero. */
export function HeroAppMock() {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="bg-foreground/20 h-2.5 w-28 rounded-full" />
        <div className="bg-foreground/15 h-2.5 w-16 rounded-full" />
      </div>
      <div className="bg-foreground/10 h-px w-full" />
      <div className="grid flex-1 grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, day) => (
          <div
            key={day}
            className="border-border/40 relative overflow-hidden rounded-md border"
          >
            <div className="border-border/40 border-b">
              <div className="bg-foreground/15 mx-auto mt-1 h-1.5 w-4 rounded-full" />
              <div className="bg-foreground/10 mx-auto my-1 h-1.5 w-3 rounded-full" />
            </div>
            {BLOCKS.filter((block) => block.day === day).map((block, i) => (
              <div
                key={i}
                className={cn(
                  "absolute right-1 left-1 rounded-sm px-1 py-0.5",
                  block.color,
                )}
                style={{ top: `${block.top}%`, height: `${block.height}%` }}
              >
                <div className="bg-white/60 h-1 w-2/3 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="bg-primary/20 flex h-5 items-center gap-1 rounded-full px-2">
          <div className="size-1.5 rounded-full bg-primary" />
          <div className="bg-primary/60 h-1.5 w-10 rounded-full" />
        </div>
        <div className="bg-foreground/15 h-1.5 w-20 rounded-full" />
      </div>
    </div>
  );
}