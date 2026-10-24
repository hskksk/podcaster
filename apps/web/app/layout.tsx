import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { DraftModeBanner } from "../components/DraftModeBanner";
import { ThemeProvider } from "../components/ThemeProvider";
import "./globals.css";

const portalDescription = "調べた記事と音声、中学受験の週次ものがたり。";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { default: "hskksk", template: "%s" },
    description: portalDescription,
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: "hskksk",
      title: "hskksk",
      description: portalDescription,
      locale: "ja_JP",
    },
    twitter: {
      card: "summary_large_image",
      title: "hskksk",
      description: portalDescription,
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
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&family=Noto+Serif+JP:wght@500;600;700&family=Zen+Maru+Gothic:wght@400;500;700;900&display=swap"
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
        <ThemeProvider>
          <DraftModeBanner />
          {children}
        </ThemeProvider>
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
