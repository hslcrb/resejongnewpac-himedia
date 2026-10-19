"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
        <footer id="footer" className="renewal-footer">
            <div className="footer-utility">
                <div className="container">
                    <p>예술과 더 가까워지는 방법.</p>
                    <Link href="/news/newsletter">
                        세종의 소식 받아보기 →
                    </Link>
                </div>
            </div>

            <div className="container footer-main">
                <div className="footer-identity">
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
                        서울의 중심에서<br />
                        당신의 일상에 예술을.
                    </p>
                    <span className="identity-marks" aria-hidden="true">
                        <i></i><i></i><i></i>
                    </span>
                </div>

                <div className="footer-information">
                    <nav className="footer-policy" aria-label="정책과 안내">
                        <Link href="/policy/privacy">개인정보처리방침</Link>
                        <Link href="/policy/terms">이용약관</Link>
                        <Link href="/visit/support">고객지원</Link>
                        <Link href="/sitemap">사이트맵</Link>
                    </nav>
                    <address>
                        서울특별시 종로구 세종대로 175<br />
                        재단법인 세종문화회관
                    </address>
                    <p className="footer-small">© SEJONG CENTER FOR THE PERFORMING ARTS.</p>
                    <p className="footer-small">
                        이것은 공식 페이지가 아닙니다. <span lang="en">This is not an official website.</span><br />
                        프로그램·일정·요금은 체험용이며 실제 예매나 신청은 이루어지지 않습니다.
                    </p>
                </div>

                <div className="footer-service">
                    <span>전화예매 및 문의</span>
                    <a className="footer-phone" href="tel:023991000">02-399-1000</a>
                    <label htmlFor="family-site" className="sr-only">관련 페이지</label>
                    <select id="family-site" onChange={handleFamilySiteChange} defaultValue="">
                        <option value="">패밀리 사이트</option>
                        <option value="/about/companies">서울시예술단</option>
                        <option value="/programs/education">세종예술아카데미</option>
                        <option value="/programs/history">세종·충무공 이야기</option>
                    </select>
                    <a className="version-link" href="/">
                        전체 버전 비교 ↗
                    </a>
                </div>
            </div>
        </footer>
    );
}
