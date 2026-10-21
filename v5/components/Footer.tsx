import Link from "next/link";
import Icon from "./Icon";

// [기관 안내와 다음 방문의 연결 / Institutional information and the next visit]
export default function Footer() {
    return (
        <footer id="footer" className="renewal-footer glass-footer" data-home-anchor>
            <div className="glass-footer-inner">
                <div className="glass-footer-invitation" id="footer-newsletter" data-home-anchor>
                    <div><span>예술이 있는 일상</span><h2>다음 만남도,<br />세종에서.</h2></div>
                    <Link href="/news/newsletter" className="glass-footer-subscribe"><span>세종의 소식 받아보기</span><Icon name="arrow" size={28} /></Link>
                </div>
                <div className="glass-footer-main">
                    <div className="glass-footer-identity" id="footer-identity" data-home-anchor>
                        <Link href="/" aria-label="세종문화회관 홈">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/v5/assets/images/sejong-wordmark.png" alt="세종문화회관" width={236} height={43} loading="lazy" />
                        </Link>
                        <address>서울특별시 종로구 세종대로 175<br />재단법인 세종문화회관</address>
                        <a href="https://www.sejongpac.or.kr/portal/main/main.do" className="glass-footer-official" target="_blank" rel="noopener noreferrer">공식 홈페이지<Icon name="diagonal" size={19} /><span className="sr-only"> (새 창)</span></a>
                    </div>
                    <div className="glass-footer-information" id="footer-information" data-home-anchor>
                        <nav className="glass-footer-policy" id="footer-policy" data-home-anchor aria-label="정책과 고객 안내">
                            <Link href="/policy/privacy" id="footer-policy-privacy" data-home-anchor>개인정보처리방침</Link>
                            <Link href="/policy/terms" id="footer-policy-terms" data-home-anchor>이용약관</Link>
                            <Link href="/visit/support" id="footer-support" data-home-anchor>고객지원</Link>
                            <Link href="/sitemap" id="footer-sitemap" data-home-anchor>사이트맵</Link>
                        </nav>
                        <nav className="glass-footer-related" aria-label="세종의 공간과 프로그램">
                            <Link href="/about/companies">서울시예술단</Link>
                            <Link href="/programs/education">세종예술아카데미</Link>
                            <Link href="/programs/history">세종·충무공 이야기</Link>
                            <Link href="/about/arts-center">꿈의숲 아트센터</Link>
                        </nav>
                    </div>
                    <div className="glass-footer-service" id="footer-service" data-home-anchor>
                        <span>전화예매·문의</span>
                        <a className="glass-footer-phone" href="tel:023991000" id="footer-phone" data-home-anchor>02-399-1000</a>
                        <Link href="/visit/support/faq">자주 묻는 질문<Icon name="arrow" size={20} /></Link>
                        <a className="glass-footer-citybrand" id="footer-citybrand" data-home-anchor href="https://www.seoul.go.kr/main/index.jsp" target="_blank" rel="noopener noreferrer" aria-label="서울특별시 홈페이지 (새 창)">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/v5/assets/logos/seoulmysoul-citybrand.svg" alt="SEOUL MY SOUL" width={624} height={101} loading="lazy" />
                        </a>
                        <details className="glass-footer-family" id="family-site" data-home-anchor>
                            <summary>관련 공식 사이트<Icon name="plus" size={20} /></summary>
                            <nav aria-label="관련 공식 사이트">
                                <a href="https://www.sejongpac.or.kr/portal/academy/academyProgram/list.do?menuNo=200560" target="_blank" rel="noopener noreferrer">세종예술아카데미<Icon name="diagonal" size={18} /><span className="sr-only"> (새 창)</span></a>
                                <a href="https://www.sejongpac.or.kr/portal/performance/performance/sejongIntro.do?menuNo=200575" target="_blank" rel="noopener noreferrer">세종·충무공 이야기<Icon name="diagonal" size={18} /><span className="sr-only"> (새 창)</span></a>
                                <a href="https://www.sejongpac.or.kr/dfac/main/main.do" target="_blank" rel="noopener noreferrer">꿈의숲 아트센터<Icon name="diagonal" size={18} /><span className="sr-only"> (새 창)</span></a>
                            </nav>
                        </details>
                    </div>
                </div>
                {/* [비공식 콘셉트 고지 / Honest unofficial concept disclosure] */}
                <div className="glass-footer-bottom">
                    <p>비공식 디자인 콘셉트입니다. 예매·신청은 체험용이며, 실제 이용은 공식 홈페이지를 확인해 주세요.</p>
                    <a href="/" id="footer-versions" data-home-anchor>버전 둘러보기<Icon name="diagonal" size={18} /></a>
                </div>
            </div>
        </footer>
    );
}
