"use client";

import type { ComponentType } from "react";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "@/lib/i18n";
import { CONTROL_IDLE } from "@/lib/ui-tokens";
import { cn } from "@/lib/utils";
import { useBlogPostEditorContext } from "./BlogPostEditorContext";

interface ToolButtonProps {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: ToolButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      // Keep the text selection: a mousedown on the button would otherwise
      // move focus out of the editor before the command runs.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        active
          ? "bg-primary/10 text-primary hover:bg-primary/15"
          : CONTROL_IDLE,
      )}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

// Only what the blog schema allows (lib/blog/extensions.ts): no H1/H4, no
// code, no tables.
export function EditorToolbar() {
  const { editor, setLinkDialogOpen, setImageDialogOpen } =
    useBlogPostEditorContext();
  const { t } = useTranslations();

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            link: e.isActive("link"),
            bulletList: e.isActive("bulletList"),
            orderedList: e.isActive("orderedList"),
            blockquote: e.isActive("blockquote"),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  });

  if (!editor || !state) return null;
  const chain = () => editor.chain().focus();
  const label = (key: string) => t(`admin.blog.toolbar.${key}`);

  return (
    <div
      role="toolbar"
      aria-label={label("label")}
      className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5"
    >
      <ToolButton
        label={label("heading2")}
        icon={Heading2}
        active={state.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        label={label("heading3")}
        icon={Heading3}
        active={state.h3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolButton
        label={label("bold")}
        icon={Bold}
        active={state.bold}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolButton
        label={label("italic")}
        icon={Italic}
        active={state.italic}
        onClick={() => chain().toggleItalic().run()}
      />
      <ToolButton
        label={label("underline")}
        icon={Underline}
        active={state.underline}
        onClick={() => chain().toggleUnderline().run()}
      />
      <ToolButton
        label={label("strike")}
        icon={Strikethrough}
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      />
      <ToolButton
        label={label("link")}
        icon={Link2}
        active={state.link}
        onClick={() => setLinkDialogOpen(true)}
      />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolButton
        label={label("bulletList")}
        icon={List}
        active={state.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolButton
        label={label("orderedList")}
        icon={ListOrdered}
        active={state.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolButton
        label={label("quote")}
        icon={Quote}
        active={state.blockquote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <ToolButton
        label={label("horizontalRule")}
        icon={Minus}
        onClick={() => chain().setHorizontalRule().run()}
      />
      <ToolButton
        label={label("image")}
        icon={ImagePlus}
        onClick={() => setImageDialogOpen(true)}
      />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolButton
        label={label("undo")}
        icon={Undo2}
        disabled={!state.canUndo}
        onClick={() => chain().undo().run()}
      />
      <ToolButton
        label={label("redo")}
        icon={Redo2}
        disabled={!state.canRedo}
        onClick={() => chain().redo().run()}
      />
    </div>
  );
}
