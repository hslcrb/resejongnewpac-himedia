import type { ReactNode } from "react";
import { SystemControlGroup } from "./SystemControlGroup";
import { SystemLink } from "./SystemPrimitives";
import { SystemText } from "./SystemText";
import "../styles/completed-pages.css";

// [페이지 사이에서 유지되는 제목과 탐색 / Shared heading and navigation across pages]
export default function PageHeading({
    title,
    summary,
    breadcrumbs,
    group,
    path,
}: {
    title: string;
    summary?: ReactNode;
    breadcrumbs: ReactNode;
    group?: { title: string; items: readonly (readonly [string, string])[] };
    path: string;
}) {
    return (
        <>
            <nav className="completed-breadcrumbs" data-text="body" aria-label="현재 위치">
                {breadcrumbs}
            </nav>
            <header className="completed-heading" data-component-id="page-heading">
                <SystemText as="h1" variant="title">
                    {title}
                </SystemText>
                {summary && (
                    <SystemText as="p" variant="lead">
                        {summary}
                    </SystemText>
                )}
            </header>
            {group && (
                <SystemControlGroup
                    as="nav"
                    className="completed-group-navigation"
                    aria-label={`${group.title} 메뉴`}
                    columns={{ compact: 2, medium: 3, wide: 6 }}
                >
                    {group.items.map(([label, href]) => (
                        <SystemLink
                            key={href}
                            variant={
                                path === href || path.startsWith(`${href}/`)
                                    ? "primary"
                                    : "secondary"
                            }
                            href={href}
                            aria-current={path === href ? "page" : undefined}
                        >
                            {label}
                        </SystemLink>
                    ))}
                </SystemControlGroup>
            )}
        </>
    );
}
