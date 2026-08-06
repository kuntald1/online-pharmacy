import { useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color, FontSize } from "@tiptap/extension-text-style";
import { Bold, Italic, UnderlineIcon, List, ListOrdered, Heading2, Heading3 } from "lucide-react";

// Module-level, not inside the component: guarantees ONE stable array
// reference for the app's whole lifetime, avoiding unnecessary editor
// recreation on re-render. Good practice regardless of the note below.
//
// NOTE: Underline is deliberately NOT imported/added separately here —
// StarterKit v3 already bundles it. Adding @tiptap/extension-underline on
// top of that registered it twice ("Duplicate extension names found:
// ['underline']", confirmed via console warning). Removing the duplicate
// was a genuine fix in its own right, but did NOT resolve the issue below.
//
// KNOWN OPEN ISSUE (unresolved as of this comment): text typed into this
// editor intermittently — not consistently — picks up an unintended bold
// mark with zero user action. Confirmed real via 20+ repeated automated
// trials (not a one-off), and confirmed NOT caused by: mousedown/focus
// stealing selection, ProseMirror's scroll-into-view, editor recreation on
// re-render, or the duplicate Underline extension above (all tested and
// ruled out individually). Root cause not yet found. If picked back up:
// next step was inspecting the live editor's transaction/mark state via
// `window.__debugEditor` at the exact moment before/after the first
// keystroke, to see what sets the mark, since the mark appears with zero
// document-changing steps (a stored-mark-only transaction) before the
// actual text insertion.
const EXTENSIONS = [StarterKit, TextStyle, Color, FontSize];

const FONT_SIZES = [
  { label: "Normal", value: null },
  { label: "Small", value: "13px" },
  { label: "Large", value: "20px" },
  { label: "X-Large", value: "26px" },
];

const COLORS = ["#14201F", "#02A694", "#1FAFE8", "#E8A33D", "#D6483F"];

function ToolbarButton({ onClick, active, children, title }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
        active ? "bg-teal text-white" : "text-ink-soft hover:bg-bg hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange }) {
  // Captured once, at mount — the editor is intentionally uncontrolled
  // after that (the standard pattern for rich text editors). Continuing to
  // feed the live `value` prop back in as `content` on every render was
  // the other half of the recreation-loop problem described above.
  const initialContent = useRef(value || "<p></p>");

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: initialContent.current,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose-sm max-w-none focus:outline-none min-h-[140px] px-3 py-2 text-sm text-ink",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-bg/60 px-2 py-1.5">
        <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={15} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton title="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={15} />
        </ToolbarButton>
        <ToolbarButton title="Subheading" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={15} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={15} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <select
          className="h-8 text-xs border border-border rounded-md px-1.5 text-ink-soft bg-white"
          onChange={(e) => {
            const size = e.target.value || null;
            if (size) editor.chain().focus().setFontSize(size).run();
            else editor.chain().focus().unsetFontSize().run();
          }}
          defaultValue=""
        >
          {FONT_SIZES.map((s) => (
            <option key={s.label} value={s.value || ""}>{s.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 ml-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setColor(c).run()}
              className="h-5 w-5 rounded-full border border-border"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
