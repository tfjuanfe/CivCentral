import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mediaKind } from "@/lib/media";

// Renders entry bodies. react-markdown does not render raw HTML by default,
// so author markdown is sanitized for free.
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt }) => mediaKind(src ?? "") === "video" ?
            <video className="uploaded-media" src={src} controls preload="metadata" aria-label={alt || "Uploaded video"} /> :
            mediaKind(src ?? "") === "audio" ?
            <audio className="uploaded-media" src={src} controls preload="metadata" aria-label={alt || "Uploaded audio"} /> :
            <img src={src} alt={alt ?? ""} loading="lazy" />,
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
