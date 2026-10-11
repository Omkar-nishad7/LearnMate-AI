import "./globals.css";
import { Toaster } from "sonner";
import Providers from "./providers";

export const metadata = {
  title: "LearnMate AI",
  description: "Smart learning platform for students and teachers"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}