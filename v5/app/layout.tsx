import React from "react";
import SiteShell from "../components/SiteShell";

import "../styles/compat/shared.css";
import "../styles/compat/programs.css";
import "../styles/compat/pages.css";
import "../styles/compat/flows.css";
import "../styles/tokens.css";
import "../styles/defaults.css";
import "../styles/base.css";
import "../styles/components.css";
import "../styles/home.css";
import "../styles/programs.css";
import "../styles/information.css";
import "../styles/transactions.css";
import "../styles/cards.css";
import "../styles/notices.css";
import "../public/assets/icons/material-symbols.css";
import "../public/assets/ui-feedback.css";
import "../styles/refinements.css";
import "../styles/experiences.css";
import "../styles/goods.css";
import "../styles/motion.css";
import "../styles/experience.css";
import "../styles/home-v4.css";
import "../styles/story.css";
import "../styles/journeys.css";
import "../styles/liquid-glass.css";
import "../styles/floating-menu.css";
import "../styles/design-system.css";
import "../styles/small-notification-modal.css";
import "../styles/hero-companion.css";
import "../styles/system-primitives.css";
import "../styles/component-catalog.css";
import "../styles/account-mini-room.css";
import "../styles/account-space.css";

export const metadata = {
    title: "세종문화회관 - 공연·전시·교육, 예매와 이용 안내 (Next.js & TypeScript)",
    description: "세종문화회관 리뉴얼 콘셉트. 공연·전시·교육 일정과 예매, 이용 안내를 한곳에서 확인하세요. Next.js App Router & TypeScript 기반 비공식 콘셉트 사이트입니다.",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko">
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="theme-color" content="#ffffff" />
                <link rel="icon" type="image/svg+xml" href="/v5/assets/favicon.svg" />
                <link rel="preload" href="/v5/assets/fonts/woff2/WantedSansVariable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
            </head>
            <body>
                <SiteShell>{children}</SiteShell>
            </body>
        </html>
    );
}
