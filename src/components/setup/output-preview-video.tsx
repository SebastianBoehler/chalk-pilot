import type { PersonBox } from "@/features/recording/presenter-tracker";

export function PresenterSelection({
  boxes,
  onSelect,
  presenter,
  size,
  videoRef,
}: {
  boxes: PersonBox[];
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void;
  presenter?: PersonBox;
  size: { width: number; height: number };
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  return (
    <article>
      <h2 className="mb-2 text-sm font-semibold">Full camera</h2>
      <button
        aria-label="Select presenter from full camera"
        className="border-border relative block w-full overflow-hidden rounded-2xl border bg-black"
        onClick={onSelect}
        style={{ aspectRatio: size.width / size.height }}
        type="button"
      >
        <video
          autoPlay
          className="absolute inset-0 size-full"
          muted
          playsInline
          ref={videoRef}
        />
        {boxes.map((box) => (
          <span
            className={`pointer-events-none absolute rounded-xl border-4 ${
              presenter?.id === box.id ? "border-primary" : "border-white"
            }`}
            key={box.id}
            style={{
              height: `${box.height * 100}%`,
              left: `${box.x * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.width * 100}%`,
            }}
          />
        ))}
      </button>
    </article>
  );
}

export function VideoPreview({
  label,
  title,
  videoRef,
}: {
  label: string;
  title: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  return (
    <article>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <video
        aria-label={label}
        autoPlay
        className="border-border aspect-video w-full rounded-2xl border bg-black object-contain"
        muted
        playsInline
        ref={videoRef}
      />
    </article>
  );
}
