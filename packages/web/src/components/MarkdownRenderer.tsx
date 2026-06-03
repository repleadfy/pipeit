import mermaid from "mermaid";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Match the active color mode so diagrams aren't dark-on-light.
    const dark = document.documentElement.classList.contains("dark");
    mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "neutral" });
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid.render(id, code).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    });
  }, [code]);

  return <div ref={ref} className="my-4 flex justify-center" />;
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <article className="prose max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex, rehypeSlug, rehypeAutolinkHeadings]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-mermaid/.exec(className ?? "");
            if (match) return <MermaidBlock code={String(children).trim()} />;
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // Wrap tables so only the table scrolls horizontally — the page never
          // does. Keeps native display:table (full-width, no cosmetic regression).
          table({ children, ...props }) {
            return (
              <div className="pi-table-scroll">
                <table {...props}>{children}</table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
