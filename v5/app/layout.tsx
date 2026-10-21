import React from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Toast from "../components/Toast";
import ReturnTop from "../components/ReturnTop";
import ContextMenu from "../components/ContextMenu";

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
import "../styles/official-services.css";
import "../styles/liquid-glass.css";
import "../styles/navigation-glass.css";
import "../styles/programs-glass.css";

export const metadata = {
    title: "세종문화회관 - 당신의 하루에, 예술 한 장면",
    description: "공연·전시·교육부터 방문 안내까지. 세종문화회관을 만나는 새로운 방법. 비공식 리뉴얼 콘셉트 사이트입니다.",
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
                <meta name="theme-color" content="#f6f5f1" />
                <link rel="icon" type="image/svg+xml" href="/v5/assets/favicon.svg" />
                <link rel="preload" href="/v5/assets/fonts/woff2/WantedSansVariable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
            </head>
            <body>
                <a className="skip-link" href="#main">
                    본문 바로가기
                </a>
                <Header />
                <main id="main" tabIndex={-1}>
                    {children}
                </main>
                <Footer />
                <Toast />
                <ReturnTop />
                <ContextMenu />
            </body>
        </html>
    );
}
