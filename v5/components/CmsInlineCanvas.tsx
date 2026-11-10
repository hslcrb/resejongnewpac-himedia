"use client";

import { useState } from "react";
import type { CmsDocumentAst, CmsWysiwygNode } from "../src/cms/contracts.ts";
import { sanitizePlainText } from "../src/cms/wysiwyg.ts";

type TextElement = "h2" | "h3" | "p" | "span" | "strong";
function TextEdit({ text, label, as: Tag = "span", multiline = false, save }: {
    text: string; label: string; as?: TextElement; multiline?: boolean; save: (text: string) => void;
}) {
    const [focused, setFocused] = useState(false);
    return (
        <Tag data-text={Tag === "h2" || Tag === "h3" ? "heading" : Tag === "strong" ? "label" : "body"}
            contentEditable suppressContentEditableWarning role="textbox" aria-label={label}
            aria-multiline={multiline} tabIndex={0} spellCheck
            data-cms-inline="true" data-editing={focused}
            onFocus={() => setFocused(true)}
            onBlur={(event) => {
                setFocused(false);
                const value = sanitizePlainText(event.currentTarget.innerText);
                if (value !== text) save(value);
            }}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    event.currentTarget.textContent = text;
                    event.currentTarget.blur();
                } else if (!multiline && event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                }
            }}
            onPaste={(event) => {
                event.preventDefault();
                document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
            }}
        >{text}</Tag>
    );
}

export default function CmsInlineCanvas({ ast, onChange }: {
    ast: CmsDocumentAst;
    onChange: (next: CmsDocumentAst) => void;
}) {
    const updateNode = (id: string, change: (node: CmsWysiwygNode) => CmsWysiwygNode) => {
        onChange({ ...ast, nodes: ast.nodes.map(node => node.id === id ? change(node) : node) });
    };
    return (
        <article className="cms-inline-document" aria-label="클릭해서 직접 편집하는 페이지 본문">
            <div className="cms-inline-cover">
                <TextEdit as="h2" label="페이지 제목 직접 편집" text={ast.title}
                    save={title => onChange({ ...ast, title })} />
                <TextEdit as="p" multiline label="페이지 소개글 직접 편집" text={ast.description}
                    save={description => onChange({ ...ast, description })} />
            </div>
            {ast.nodes.map(node => (
                <section className="cms-inline-section" key={node.id} data-block-type={node.type}>
                    {node.type === "prose" && <>
                        <TextEdit as="h3" label="섹션 제목" text={node.heading}
                            save={heading => updateNode(node.id, n => n.type === "prose" ? { ...n, heading } : n)} />
                        {node.paragraphs.map((paragraph, index) =>
                            <TextEdit key={index} as="p" multiline label={`문단 ${index + 1}`} text={paragraph}
                                save={value => updateNode(node.id, n => n.type === "prose" ? {
                                    ...n, paragraphs: n.paragraphs.map((old, i) => i === index ? value : old),
                                    richParagraphs: undefined,
                                } : n)} />
                        )}
                    </>}
                    {node.type === "facts" && <>
                        <TextEdit as="h3" label="핵심정보 제목" text={node.title}
                            save={title => updateNode(node.id, n => n.type === "facts" ? { ...n, title } : n)} />
                        {node.items.map((item, index) =>
                            <p key={index} className="cms-inline-fact">
                                <TextEdit as="strong" label="항목 이름" text={item.label}
                                    save={label => updateNode(node.id, n => n.type === "facts" ? { ...n, items: n.items.map((it, i) => i === index ? { ...it, label } : it) } : n)} />
                                <TextEdit label="항목 내용" text={item.value}
                                    save={value => updateNode(node.id, n => n.type === "facts" ? { ...n, items: n.items.map((it, i) => i === index ? { ...it, value } : it) } : n)} />
                            </p>
                        )}
                    </>}
                    {node.type === "faq" && <>
                        <TextEdit as="h3" label="FAQ 제목" text={node.title}
                            save={title => updateNode(node.id, n => n.type === "faq" ? { ...n, title } : n)} />
                        {node.items.map((item, index) =>
                            <div className="cms-inline-faq" key={index}>
                                <TextEdit as="strong" label="질문 편집" text={item.question}
                                    save={question => updateNode(node.id, n => n.type === "faq" ? { ...n, items: n.items.map((it, i) => i === index ? { ...it, question } : it) } : n)} />
                                <TextEdit as="p" multiline label="답변 편집" text={item.answer}
                                    save={answer => updateNode(node.id, n => n.type === "faq" ? { ...n, items: n.items.map((it, i) => i === index ? { ...it, answer } : it) } : n)} />
                            </div>
                        )}
                    </>}
                    {node.type === "timeline" && <>
                        <TextEdit as="h3" label="연혁 제목" text={node.title}
                            save={title => updateNode(node.id, n => n.type === "timeline" ? { ...n, title } : n)} />
                        {node.items.map((item, index) =>
                            <p className="cms-inline-fact" key={index}>
                                <TextEdit as="strong" label="연도 편집" text={item.date}
                                    save={date => updateNode(node.id, n => n.type === "timeline" ? { ...n, items: n.items.map((it, i) => i === index ? { ...it, date } : it) } : n)} />
                                <TextEdit label="연혁 항목 편집" text={item.title}
                                    save={title => updateNode(node.id, n => n.type === "timeline" ? { ...n, items: n.items.map((it, i) => i === index ? { ...it, title } : it) } : n)} />
                            </p>
                        )}
                    </>}
                    {node.type === "actions" && <div className="cms-inline-actions">
                        {node.items.map((item, index) =>
                            <TextEdit key={index} label="버튼 문구 편집" text={item.label}
                                save={label => updateNode(node.id, n => n.type === "actions" ? { ...n, items: n.items.map((it, i) => i === index ? { ...it, label } : it) } : n)} />
                        )}
                    </div>}
                    {node.type === "image" && <figure>
                        <img src={node.src} alt={node.alt} loading="lazy" />
                        <figcaption>
                            <TextEdit label="사진 캡션" text={node.caption || node.alt}
                                save={caption => updateNode(node.id, n => n.type === "image" ? { ...n, caption } : n)} />
                        </figcaption>
                    </figure>}
                    {node.type === "map" && <p data-text="body">{node.label} · {node.address}</p>}
                    {node.type === "downloads" && <p data-text="body">{node.title} · {node.items.length}개 자료</p>}
                </section>
            ))}
        </article>
    );
}
