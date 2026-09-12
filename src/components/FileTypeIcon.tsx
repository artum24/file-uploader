const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "heic", "svg", "bmp", "tiff"];
const VIDEO_EXT = ["mp4", "mov", "avi", "mkv", "webm"];
const AUDIO_EXT = ["mp3", "wav", "m4a", "flac"];

export type FileKind = "folder" | "pdf" | "image" | "video" | "audio" | "generic";

export function getFileKind(name: string): FileKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXT.includes(ext)) return "image";
  if (VIDEO_EXT.includes(ext)) return "video";
  if (AUDIO_EXT.includes(ext)) return "audio";
  return "generic";
}

const STYLES: Record<FileKind, { bg: string; fg: string }> = {
  folder: { bg: "#EBF0EA", fg: "#5E7C63" },
  pdf: { bg: "#F4F4F1", fg: "#C0392E" },
  image: { bg: "#D9E0E6", fg: "#4F6274" },
  video: { bg: "#EAE3EC", fg: "#6A5473" },
  audio: { bg: "#F4F4F1", fg: "#7A7F76" },
  generic: { bg: "#F4F4F1", fg: "#7A7F76" },
};

function IconGlyph({ kind }: { kind: FileKind }) {
  switch (kind) {
    case "folder":
      return (
        <path d="M20 20a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 4.9A2 2 0 0 0 7.93 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
      );
    case "pdf":
      return (
        <>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v5h6" />
          <path d="M8 15h8" />
          <path d="M8 18h5" />
        </>
      );
    case "image":
      return (
        <>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="9" cy="9.5" r="1.6" />
          <path d="M21 15l-4.5-4.5L6 21" />
        </>
      );
    case "video":
      return (
        <>
          <rect x="2.5" y="5" width="19" height="14" rx="3" />
          <path d="M10.5 9.5l5 2.5-5 2.5Z" />
        </>
      );
    case "audio":
      return (
        <>
          <path d="M9 18V5l11-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="17" cy="16" r="3" />
        </>
      );
    case "generic":
    default:
      return (
        <>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v5h6" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </>
      );
  }
}

export function FileTypeIcon({
  kind,
  size = 40,
  className = "",
}: {
  kind: FileKind;
  size?: number;
  className?: string;
}) {
  const { bg, fg } = STYLES[kind];
  const iconSize = Math.round(size * 0.475);

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl ${className}`}
      style={{ width: size, height: size, background: bg, color: fg }}
      aria-hidden
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <IconGlyph kind={kind} />
      </svg>
    </div>
  );
}
