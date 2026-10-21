"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SystemField } from "./SystemPrimitives";

export default function Footer() {
    const router = useRouter();

    const handleFamilySiteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val) {
            router.push(val);
            e.target.value = "";
        }
    };

    return (
        <footer id="footer" className="renewal-footer" data-home-anchor>
            <div className="footer-utility" id="footer-newsletter" data-home-anchor>
                <div className="container">
                    <p>세종문화회관의 새 소식.</p>
                    <Link href="/news/newsletter">
                        세종의 소식 받아보기 →
                    </Link>
                </div>
            </div>

            <div className="container footer-main">
                <div className="footer-identity" id="footer-identity" data-home-anchor>
                    <Link href="/" aria-label="세종문화회관 홈">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            className="sejong-wordmark"
                            src="/v5/assets/images/sejong-wordmark.png"
                            alt="세종문화회관"
                            width={236}
                            height={43}
                            onError={(e) => {
                                const target = e.currentTarget;
                                if (!target.src.includes("/assets/")) {
                                    target.src = "/assets/images/sejong-wordmark.png";
                                }
                            }}
                        />
                    </Link>
                    <p>
                        공연·전시·교육
                        <br />
                        한 곳에서 이어지는 무대.
                    </p>
                    <span className="identity-marks" aria-hidden="true">
                        <i></i><i></i><i></i>
                    </span>
                </div>

                <div className="footer-information" id="footer-information" data-home-anchor>
                    <nav className="footer-policy" id="footer-policy" data-home-anchor aria-label="정책과 안내">
                        <Link href="/policy/privacy" id="footer-policy-privacy" data-home-anchor>개인정보처리방침</Link>
                        <Link href="/policy/terms" id="footer-policy-terms" data-home-anchor>이용약관</Link>
                        <Link href="/design-rules" id="footer-policy-design-system" data-home-anchor>디자인 시스템</Link>
                        <Link href="/visit/support" id="footer-support" data-home-anchor>고객지원</Link>
                        <Link href="/sitemap" id="footer-sitemap" data-home-anchor>사이트맵</Link>
                    </nav>
                    <address>
                        서울특별시 종로구 세종대로 175<br />
                        재단법인 세종문화회관
                    </address>
                    <p className="footer-small">© SEJONG CENTER FOR THE PERFORMING ARTS.</p>
                    <p className="footer-small">
                        이것은 공식 페이지가 아닙니다. <span lang="en">This is not an official website.</span>
                    </p>
                </div>

                <div className="footer-service" id="footer-service" data-home-anchor>
                    <span>전화예매 및 문의</span>
                    <a className="footer-phone" href="tel:023991000" id="footer-phone" data-home-anchor>02-399-1000</a>
                    <a className="footer-citybrand" id="footer-citybrand" data-home-anchor href="https://www.seoul.go.kr/main/index.jsp">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/v5/assets/logos/seoulmysoul-citybrand.svg"
                            alt="서울시 로고 SEOUL MY SOUL"
                            width={624.55}
                            height={101.21}
                            loading="lazy"
                        />
                    </a>
                    <SystemField as="select" label="관련 페이지" labelHidden id="family-site" data-home-anchor onChange={handleFamilySiteChange} defaultValue="">
                        <option value="">패밀리 사이트</option>
                        <option value="/about/companies">서울시예술단</option>
                        <option value="/programs/education">세종예술아카데미</option>
                        <option value="/programs/history">세종·충무공 이야기</option>
                    </SystemField>
                    <a className="version-link" href="/" id="footer-versions" data-home-anchor>
                        전체 버전 비교 ↗
                    </a>
                </div>
            </div>
        </footer>
    );
}
