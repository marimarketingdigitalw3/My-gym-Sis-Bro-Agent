// Texto con formato mínimo y seguro (negritas, títulos y viñetas), sin HTML. Lo usan el coach y los consejos de outfits.
import { Fragment, type ReactNode } from "react";

/** Render mínimo y seguro: negritas (**x**) y viñetas, sin HTML. */
export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
  const flush = () => {
    if (bullets.length) blocks.push(<ul key={`u${blocks.length}`} className="list-disc space-y-1 pl-5">{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>);
    bullets = [];
  };
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(?:[•\-*]|\d+\.)\s+(.*)$/);
    if (m) bullets.push(m[1]);
    else {
      flush();
      if (/^\s*#{1,6}\s+/.test(line)) blocks.push(<p key={`h${blocks.length}`} className="pt-1 font-semibold">{inline(line.replace(/^\s*#+\s*/, ""))}</p>);
      else if (line.trim()) blocks.push(<p key={`p${blocks.length}`}>{inline(line)}</p>);
    }
  }
  flush();
  return <div className="prose-coach space-y-2">{blocks}</div>;
}
