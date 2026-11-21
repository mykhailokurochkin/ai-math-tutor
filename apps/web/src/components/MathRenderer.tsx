"use client";

import React from "react";
import katex from "katex";

export function MathFormula({
  latex,
  displayMode = false,
  className = "",
}: {
  latex: string;
  displayMode?: boolean;
  className?: string;
}) {
  const html = React.useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return latex;
    }
  }, [latex, displayMode]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Renders markdown-lite text containing display math ($$...$$), inline math ($...$),
 * bold (**...**), and inline code (`...`).
 */
export function RichMathText({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  const paragraphs = content.split(/\n\n+/);

  return (
    <div className={`space-y-2.5 leading-relaxed ${className}`}>
      {paragraphs.map((para, pIdx) => {
        const trimmed = para.trim();
        if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 4) {
          const innerLatex = trimmed.slice(2, -2).trim();
          return (
            <div
              key={pIdx}
              className="my-2 py-2.5 px-4 rounded-xl bg-black/[0.025] border border-black/[0.05] text-center overflow-x-auto"
            >
              <MathFormula latex={innerLatex} displayMode />
            </div>
          );
        }

        // Tokenize by $$...$$, $...$, **...**, `...`
        const tokens = para.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\*\*[^*]+?\*\*|`[^`]+?`)/g);

        return (
          <p key={pIdx} className="whitespace-pre-wrap">
            {tokens.map((tok, tIdx) => {
              if (!tok) return null;
              if (tok.startsWith("$$") && tok.endsWith("$$") && tok.length > 4) {
                return (
                  <span
                    key={tIdx}
                    className="block my-2 py-2 px-3 rounded-xl bg-black/[0.025] border border-black/[0.05] text-center"
                  >
                    <MathFormula latex={tok.slice(2, -2).trim()} displayMode />
                  </span>
                );
              }
              if (tok.startsWith("$") && tok.endsWith("$") && tok.length > 2) {
                return (
                  <MathFormula
                    key={tIdx}
                    latex={tok.slice(1, -1).trim()}
                    className="mx-0.5 font-medium text-[#111113]"
                  />
                );
              }
              if (tok.startsWith("**") && tok.endsWith("**") && tok.length > 4) {
                const inner = tok.slice(2, -2);
                // Check if inner contains $...$
                if (inner.startsWith("$") && inner.endsWith("$") && inner.length > 2) {
                  return (
                    <span
                      key={tIdx}
                      className="font-semibold text-[#111113] bg-black/[0.04] px-1.5 py-0.5 rounded-md mx-0.5"
                    >
                      <MathFormula latex={inner.slice(1, -1).trim()} />
                    </span>
                  );
                }
                return (
                  <strong key={tIdx} className="font-semibold text-[#111113]">
                    {inner}
                  </strong>
                );
              }
              if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2) {
                return (
                  <code
                    key={tIdx}
                    className="px-1.5 py-0.5 rounded-md bg-black/[0.05] font-mono text-[0.88em] text-[#1D1D1F]"
                  >
                    {tok.slice(1, -1)}
                  </code>
                );
              }
              return <React.Fragment key={tIdx}>{tok}</React.Fragment>;
            })}
          </p>
        );
      })}
    </div>
  );
}
