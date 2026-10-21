import React from "react";
import { notFound } from "next/navigation";
import { PROGRAMS, PAGES } from "../../../src/data/catalog";
import type { Program } from "../../../types/sejong.ts";
import ProgramDetailClient from "./ProgramDetailClient";
import ServicePageClient from "../../../components/ServicePageClient";

export function generateStaticParams() {
    return PAGES.filter((page) => /^\/programs\/[^/]+$/.test(page.path)).map((page) => ({ id: page.path.split("/")[2] }));
}

export default function ProgramDetailPage({
    params,
}: {
    params: { id: string };
}) {
    const program = (PROGRAMS as unknown as Program[]).find((p) => String(p.id) === params.id);
    if (!program) {
        const path = "/programs/" + params.id;
        if (!PAGES.some((page) => page.path === path)) notFound();
        return <ServicePageClient path={path} />;
    }

    return <ProgramDetailClient program={program} />;
}
