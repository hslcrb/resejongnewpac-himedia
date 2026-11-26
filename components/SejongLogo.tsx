import type { ImgHTMLAttributes } from "react";

export const SEJONG_LOGO_SRC = "/assets/logos/sejong-center-for-the-performing-arts.svg";

// [사용자 원본 SVG를 공유하는 로고 / Shared logo using the supplied original SVG]
// 헤더·푸터·가이드가 같은 자산을 사용하며 화면별 크기와 대체 텍스트를 보존합니다.
// Keep one asset across product and guide, preserving each context's size and accessible name.
export default function SejongLogo({
    alt = "세종문화회관",
    width = 236,
    height = 43,
    ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "onError">) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
        <img
            {...props}
            src={SEJONG_LOGO_SRC}
            alt={alt}
            width={width}
            height={height}
            data-component-id="sejong-logo"
        />
    );
}
