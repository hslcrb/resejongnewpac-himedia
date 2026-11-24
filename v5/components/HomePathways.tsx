import Link from "next/link";
import Icon from "./Icon";
import { SystemText } from "./SystemText";
import { SystemLink } from "./SystemPrimitives";
import "../styles/home-pathways.css";

export const HOME_PATHWAY_ICON_SIZE = 32;
export const HOME_PATHWAY_ARROW_SIZE = 22;

const pathways = [
    {
        id: "programs",
        title: "일정·예매",
        description: "공연·전시·교육 살펴보기",
        href: "/programs",
        icon: "calendar",
    },
    {
        id: "group",
        title: "단체 관람",
        description: "단체관람 안내와 신청",
        href: "/visit/group",
        icon: "ticket",
    },
    {
        id: "rental",
        title: "대관",
        description: "대관 시설과 일정 확인",
        href: "/rental",
        icon: "pin",
    },
] as const;

// [아이콘·내용·화살표를 묶는 바로가기 / Shortcuts keeping icon, copy and arrow together]
// 이전 아이콘과 오른쪽 정렬을 유지하고 화살표만 끝에서 16px 안쪽에 둡니다.
// Restore the original icons and right alignment, with only a 16px arrow inset.
export default function HomePathways({
    id = "home-pathways",
    className = "",
}: {
    id?: string;
    className?: string;
}) {
    const prefix = id === "home-pathways" ? "home-pathway" : id;
    return (
        <nav
            id={id}
            className={`home-pathways ${className}`.trim()}
            data-component-id="home-pathways"
            data-home-anchor
            aria-label="이용 목적별 바로가기"
        >
            <div className="home-pathway-list">
                {pathways.map((item) => (
                    <Link
                        key={item.id}
                        id={`${prefix}-${item.id}`}
                        href={item.href}
                        className="home-pathway-link"
                        data-home-anchor
                        aria-labelledby={`${prefix}-${item.id}-title`}
                        aria-describedby={`${prefix}-${item.id}-description`}
                    >
                        <span className="home-pathway-content">
                            <Icon
                                name={item.icon}
                                size={HOME_PATHWAY_ICON_SIZE}
                                className="home-pathway-symbol"
                            />
                            <span className="home-pathway-copy">
                                <SystemText
                                    as="strong"
                                    variant="item-title"
                                    id={`${prefix}-${item.id}-title`}
                                >
                                    {item.title}
                                </SystemText>
                                <SystemText
                                    as="span"
                                    variant="caption"
                                    className="home-pathway-description"
                                    id={`${prefix}-${item.id}-description`}
                                >
                                    {item.description}
                                </SystemText>
                            </span>
                            <Icon
                                name="arrow"
                                size={HOME_PATHWAY_ARROW_SIZE}
                                className="home-pathway-arrow"
                            />
                        </span>
                    </Link>
                ))}
            </div>
            <div className="page-layout-actions">
                <SystemLink href="/booking/experience/" variant="secondary">
                    관람예약 체험하기
                </SystemLink>
            </div>
        </nav>
    );
}
