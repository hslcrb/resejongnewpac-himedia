import React from "react";
import { notFound } from "next/navigation";
import { PROGRAMS } from "../../../src/data/catalog";
import { Program } from "../../../types/sejong";
import BookingClient from "./BookingClient";

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

    return <BookingClient program={program} />;
}
