import React from "react";
import { notFound } from "next/navigation";
import { PROGRAMS } from "../../../src/data/catalog";
import type { Program } from "../../../types/sejong.ts";
import ServicePageClient from "../../../components/ServicePageClient";

export function generateStaticParams() {
    return (PROGRAMS as unknown as Program[]).map((p) => ({
        id: String(p.id),
    }));
}

export default function BookingPage({
    params,
}: {
    params: { id: string };
}) {
    const program = (PROGRAMS as unknown as Program[]).find((p) => String(p.id) === params.id);
    if (!program) notFound();

    // [통합 예매 여정 / Unified booking journey]
    // 공유 흐름이 일정·인원·좌석·할인과 체험 내역을 함께 관리합니다.
    // The shared flow keeps schedule, party size, seats, discounts and demo records consistent.
    return <ServicePageClient path={`/booking/${program.id}`} />;
}
