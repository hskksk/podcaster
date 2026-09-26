import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "../components/ThemeProvider";
import { loadSiteConfig } from "../lib/site/config";
import { ogImageUrls, siteOpenGraphDefaults } from "../lib/site/open-graph";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const cfg = loadSiteConfig();
  const og = siteOpenGraphDefaults(cfg);
  return {
    title: { default: cfg.siteTitle, template: `%s | ${cfg.siteTitle}` },
    description: cfg.siteDescription,
    robots: { index: true, follow: true },
    openGraph: og,
    twitter: {
      card: "summary_large_image",
      title: cfg.siteTitle,
      description: cfg.siteDescription || undefined,
      images: ogImageUrls(og.images),
    },
  };
}

const themeScript = `(function(){try{var k="podcaster-theme";var t=localStorage.getItem(k);var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&family=Noto+Serif+JP:wght@500;600;700&display=swap"
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
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `document.addEventListener("DOMContentLoaded",function(){if(window.renderMathInElement){window.renderMathInElement(document.body,{delimiters:[{left:"$",right:"$",display:true},{left:"\\\\[",right:"\\\\]",display:true},{left:"\\\\(",right:"\\\\)",display:false},{left:"$",right:"$",display:false}],ignoredTags:["script","noscript","style","textarea","pre","code"]});}});`,
          }}
        />
      </body>
    </html>
  );
}
