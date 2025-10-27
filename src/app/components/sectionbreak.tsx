// app/components/SectionBreak.tsx
type Props = {
  /** Space above/below the break (px). Default: 8 */
  gap?: number;
  /** Thickness of the line (px). Default: 8 */
  height?: number;
  /** Tile the image across the width. Default: false (single image centered) */
  repeat?: boolean;
  /** Optional custom image path. Default: "/line.png" (put this in /public) */
  src?: string;
  /** Fallback color if no image (only used when repeat=false and src missing) */
  color?: string;
};

export default function SectionBreak({
  gap = 8,
  height = 8,
  repeat = false,
  src = "/line.png",
  color = "var(--line)",
}: Props) {
  const baseStyle: React.CSSProperties = {
    margin: `${gap}px 0`,
    lineHeight: 0,
  };

  // Repeating (full-width) version
  if (repeat) {
    return (
      <div role="separator" aria-hidden="true" style={baseStyle}>
        <div
          style={{
            height,
            backgroundImage: `url(${src})`,
            backgroundRepeat: "repeat-x",
            backgroundPosition: "center",
            backgroundSize: `auto ${height}px`,
          }}
        />
      </div>
    );
  }

  // Single centered image (fallback to a solid line if image not found)
  return (
    <div role="separator" aria-hidden="true" style={baseStyle}>
      <img
        src={src}
        alt=""
        onError={(e) => {
          // fallback: simple line
          (e.currentTarget.style as any).display = "none";
          const parent = e.currentTarget.parentElement;
          if (parent) {
            parent.style.height = `${height}px`;
            parent.style.background = color;
            parent.style.borderRadius = "999px";
            parent.style.maxWidth = "600px";
            parent.style.marginLeft = "auto";
            parent.style.marginRight = "auto";
            parent.style.opacity = "0.65";
          }
        }}
        style={{
          display: "block",
          margin: "0 auto",
          height,
          width: "auto",
        }}
      />
    </div>
  );
}
