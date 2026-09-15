import type { Metadata } from "next";
import type { ReactNode } from "react";
import { loadSiteConfig } from "../lib/site/config";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const cfg = loadSiteConfig();
  return {
    title: { default: cfg.siteTitle, template: `%s | ${cfg.siteTitle}` },
    description: cfg.siteDescription,
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
        />
        <script
          defer
          src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"
        />
        <script
          defer
          src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
        />
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.addEventListener("DOMContentLoaded",function(){if(window.renderMathInElement){window.renderMathInElement(document.body,{delimiters:[{left:"$$",right:"$$",display:true},{left:"\\\\[",right:"\\\\]",display:true},{left:"\\\\(",right:"\\\\)",display:false},{left:"$",right:"$",display:false}],ignoredTags:["script","noscript","style","textarea","pre","code"]});}});`,
          }}
        />
        <script
          type="module"
          dangerouslySetInnerHTML={{
            __html: `import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";mermaid.initialize({startOnLoad:true,theme:"neutral"});`,
          }}
        />
      </body>
    </html>
  );
}
