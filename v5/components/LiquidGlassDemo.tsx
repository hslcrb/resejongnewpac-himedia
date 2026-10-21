"use client";

import { useState } from "react";
import LiquidGlass from "./LiquidGlass";
import { SystemButton } from "./SystemPrimitives";
import { GLASS_DEFAULTS, GLASS_VARIANTS } from "../src/lib/liquid-glass";
import type { GlassVariant } from "../src/lib/liquid-glass";

// [같은 컴포넌트의 재질 비교 / Compare material settings on the actual component]
export default function LiquidGlassDemo({
    onCopy,
    copied,
}: {
    onCopy: (code: string) => void;
    copied: boolean;
}) {
    const [variant, setVariant] = useState<GlassVariant>("surface");
    const [opacity, setOpacity] = useState(GLASS_DEFAULTS.opacity);
    const [refraction, setRefraction] = useState(GLASS_DEFAULTS.refraction);
    const material = GLASS_VARIANTS[variant];
    const code = `import LiquidGlass from "@/components/LiquidGlass";\n\n<LiquidGlass\n    variant="${variant}"\n    opacity={${opacity.toFixed(2)}}\n    refraction={${refraction}}\n    blur={${material.blur}}\n    thickness={${material.thickness}}\n>\n    <h2>세종문화회관</h2>\n    <p>유리 위의 콘텐츠는 선명하게 유지됩니다.</p>\n</LiquidGlass>`;
    return (
        <>
            <div className="ds-glass-variant">
                <label htmlFor="glass-variant">재질 베리언트</label>
                <select id="glass-variant" value={variant} onChange={event => {
                    const next = event.target.value as GlassVariant;
                    setVariant(next);
                    setOpacity(GLASS_VARIANTS[next].opacity);
                    setRefraction(GLASS_VARIANTS[next].refraction);
                }}>
                    <option value="surface">Surface · 기본 표면</option>
                    <option value="drawer">Drawer · 모바일 서랍</option>
                </select>
            </div>
            <div className="ds-glass-stage">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/v5/assets/images/sejong-grand-interior.png"
                    alt=""
                    className="ds-glass-backdrop"
                />
                <LiquidGlass variant={variant} className="ds-glass-example" opacity={opacity} refraction={refraction}>
                    <code className="ds-glass-component-name">LiquidGlass</code>
                    <h3>빛을 머금은 유리</h3>
                    <p>배경은 가장자리에서 꺾이고, 글자는 선명하게 남습니다.</p>
                </LiquidGlass>
            </div>
            <div className="ds-glass-controls">
                <div>
                    <label htmlFor="glass-opacity">
                        불투명도{" "}
                        <output htmlFor="glass-opacity">{Math.round(opacity * 100)}%</output>
                    </label>
                    <input
                        id="glass-opacity"
                        type="range"
                        min="0.4"
                        max="0.96"
                        step="0.01"
                        value={opacity}
                        aria-valuetext={`${Math.round(opacity * 100)}%`}
                        onChange={(event) => setOpacity(Number(event.target.value))}
                    />
                </div>
                <div>
                    <label htmlFor="glass-refraction">
                        굴절 강도 <output htmlFor="glass-refraction">{refraction}</output>
                    </label>
                    <input
                        id="glass-refraction"
                        type="range"
                        min="0"
                        max="120"
                        step="1"
                        value={refraction}
                        onChange={(event) => setRefraction(Number(event.target.value))}
                    />
                </div>
            </div>
            <div className="ds-demo-actions">
                <SystemButton
                    variant="quiet"
                    onClick={() => {
                        setOpacity(material.opacity);
                        setRefraction(material.refraction);
                    }}
                >
                    기본값으로
                </SystemButton>
                <SystemButton variant="secondary" onClick={() => onCopy(code)}>
                    {copied ? "복사됨" : "코드 복사"}
                </SystemButton>
            </div>
            <pre className="ds-code-block">
                <code>{code}</code>
            </pre>
        </>
    );
}
