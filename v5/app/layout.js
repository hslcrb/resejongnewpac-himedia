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

export const metadata = {
  title: "세종문화회관 - v5 예술로 이어지는 하루 (Next.js)",
  description: "세종문화회관 리뉴얼 디자인 체험. 공연과 전시, 예술이 있는 일상을 만나보세요. 비공식 프로젝트입니다.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
      </head>
      <body>
        <a className="skip-link" href="#main">
          본문 바로가기
        </a>
        <header id="header" className="renewal-header"></header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer id="footer" className="renewal-footer"></footer>
        <div id="toast" className="toast" role="status" aria-live="polite"></div>
        <button className="return-top" type="button" aria-label="맨 위로 이동" hidden>
          <svg className="material-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
            <use href="/assets/icons/material-symbols-rounded.svg#arrow_upward"></use>
          </svg>
        </button>
      </body>
    </html>
  );
}
