"use client";

import Link from "next/link";
import Icon from "./Icon";

// [시즌 탐색 배너 / A shared editorial season banner]
export default function SeasonBanner({ id = "home-season-programs" }: { id?: string }) {
    return (
        <Link data-text="action" href="/programs/season" className="home-season-link" id={id} data-home-anchor data-component="SeasonBanner" data-component-id="season-banner">
            <span>
                <strong data-text="item-title">기획·시즌 프로그램</strong>
            </span>
            <span data-text="body">전체 보기 <Icon name="arrow" size={22} /></span>
        </Link>
    );
}
