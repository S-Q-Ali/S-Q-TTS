import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "S-Q TTS Studio | Free Neural Text to Speech",
  description: "High-quality, crystal-clear AI voices powered by Microsoft Edge Neural TTS. 100% Free.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
