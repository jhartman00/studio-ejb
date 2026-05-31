"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef } from "react";

// Tiptap value sync: the parent calls onChange on every keystroke, which
// re-renders us with a new `value` prop. Without guarding, the effect below
// would then call setContent on every keystroke and clobber the user's
// selection (space swallowed, delete jumps the cursor). The fix: stash the
// HTML we just emitted in lastSetRef from inside onUpdate so the effect only
// resyncs when an *external* parent (e.g. Discard changes) sets a new value.

type Props = {
  value: string;
  onChange: (html: string) => void;
  ariaLabel?: string;
};

export default function RichText({ value, onChange, ariaLabel }: Props) {
  const lastSetRef = useRef<string>(value || "");
  const extensions = useMemo(() => [StarterKit], []);

  const editor = useEditor({
    extensions,
    content: value || "",
    onUpdate({ editor }) {
      const html = editor.getHTML();
      lastSetRef.current = html;
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: "tiptap-editor",
        "aria-label": ariaLabel || "Rich text editor",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== lastSetRef.current) {
      editor.commands.setContent(value || "", false);
      lastSetRef.current = value || "";
    }
  }, [value, editor]);

  if (!editor) return <div className="tiptap-shell">Loading editor...</div>;

  function toggleLink() {
    if (!editor) return;
    const existing = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(
      "Link URL (leave blank to remove)",
      existing ?? "",
    );
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetMark("link").run();
      return;
    }
    if (!/^(https?:|mailto:|tel:|\/)/i.test(url)) {
      window.alert("URL must start with http:, https:, mailto:, tel:, or /");
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link" as never)
      .setMark("link" as never, { href: url, target: "_blank", rel: "noopener" })
      .run();
  }

  return (
    <div className="tiptap-shell">
      <div className="tiptap-toolbar" role="toolbar" aria-label="Formatting">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-pressed={editor.isActive("bold")}
          className="tiptap-btn"
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-pressed={editor.isActive("italic")}
          className="tiptap-btn"
        >
          Italic
        </button>
        <button
          type="button"
          onClick={toggleLink}
          aria-pressed={editor.isActive("link")}
          className="tiptap-btn"
        >
          Link
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
