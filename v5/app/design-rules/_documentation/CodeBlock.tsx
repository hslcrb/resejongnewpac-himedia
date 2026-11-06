import { useId } from "react";
import Icon from "../../../components/Icon";
import { SystemButton } from "../../../components/SystemPrimitives";
import { SystemSurface } from "../../../components/SystemSurface";
import { highlightCode } from "./code-highlight";

// [가이드 전용 코드 표면 / A shared code specimen for documentation only]
export default function CodeBlock({
    code,
    title,
    language = "tsx",
    onCopy,
    copied = false,
}: {
    code: string;
    title: string;
    language?: "tsx" | "css";
    onCopy?: () => void;
    copied?: boolean;
}) {
    const titleId = useId();
    return (
        <SystemSurface
            variant="subtle"
            padding="none"
            radius="panel"
            className="ds-code-sample"
            data-documentation-tool="code-block"
        >
            <div className="ds-code-header">
                <div className="ds-code-title">
                    <span data-text="label" id={titleId}>
                        {title}
                    </span>
                </div>
                <div className="ds-code-tools">
                    <span data-text="meta" className="ds-code-language">
                        {language.toUpperCase()}
                    </span>
                    {onCopy && (
                        <SystemButton
                            variant="quiet"
                            shape="circle"
                            onClick={onCopy}
                            aria-label={copied ? `${title} 복사됨` : `${title} 코드 복사`}
                        >
                            <Icon name={copied ? "check" : "content_copy"} size={20} />
                        </SystemButton>
                    )}
                </div>
            </div>
            <pre className="ds-code-block" tabIndex={0} role="region" aria-labelledby={titleId}>
                <code data-text="body">
                    {highlightCode(code, language).map((token, index) =>
                        token.kind === "text" ? (
                            token.text
                        ) : (
                            <span
                                data-text="body"
                                className={`ds-syntax-${token.kind}`}
                                key={index}
                            >
                                {token.text}
                            </span>
                        ),
                    )}
                </code>
            </pre>
        </SystemSurface>
    );
}
