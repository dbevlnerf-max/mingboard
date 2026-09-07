import "./globals.css";

import SessionProviderClient
  from "./session-provider";

export const metadata = {
  title:
    "게임하는밍쨩 길드 대시보드",
};


export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <SessionProviderClient>
          {children}
        </SessionProviderClient>
      </body>
    </html>
  );
}