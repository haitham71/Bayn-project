import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Markdown } from 'tiptap-markdown';
import Bold from '@/assets/icons/bold.svg?react';
import Italic from '@/assets/icons/italic.svg?react';
import List from '@/assets/icons/list.svg?react';
import ListOrdered from '@/assets/icons/list-ordered.svg?react';
import Heading from '@/assets/icons/heading.svg?react';
import './MarkdownEditor.css';

// WYSIWYG description editor: the author sees formatted text (no Markdown syntax)
// while the value stays plain Markdown on the wire — TipTap serializes the doc to
// Markdown on every change, so nothing executable (HTML) is ever stored, and the
// same react-markdown renderer displays it safely elsewhere.
export default function MarkdownEditor({
  value = '',
  onChange,
  placeholder = '',
  maxLength,
  className = '',
}) {
  const { t } = useTranslation();

  const editor = useEditor({
    extensions: [
      // Only the formats the toolbar exposes are allowed. Everything else in
      // StarterKit is switched off so nothing outside the allow-list can be
      // authored: no links/URLs, no underline (no Markdown equivalent), no
      // strike-through, code, code blocks, blockquotes or horizontal rules.
      StarterKit.configure({
        link: false,
        underline: false,
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Markdown.configure({ html: false, linkify: false, transformPastedText: true, transformCopiedText: true }),
      Placeholder.configure({ placeholder }),
      CharacterCount.configure({ limit: maxLength ?? null }),
    ],
    content: value,
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.storage.markdown.getMarkdown());
    },
  });

  // Reflect external value resets (e.g. after publish) without disturbing the
  // caret while the user is typing — the incoming value already equals the
  // serialized Markdown in that case, so this only fires on real outside changes.
  useEffect(() => {
    if (!editor) return;
    const current = editor.storage.markdown.getMarkdown();
    if (value !== current) {
      editor.commands.setContent(value || '', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const count = editor?.storage.characterCount.characters() ?? 0;

  const tools = editor
    ? [
        {
          key: 'bold',
          Icon: Bold,
          label: t('markdown.bold'),
          active: editor.isActive('bold'),
          run: () => editor.chain().focus().toggleBold().run(),
        },
        {
          key: 'italic',
          Icon: Italic,
          label: t('markdown.italic'),
          active: editor.isActive('italic'),
          run: () => editor.chain().focus().toggleItalic().run(),
        },
        {
          key: 'heading',
          Icon: Heading,
          label: t('markdown.heading'),
          active: editor.isActive('heading', { level: 3 }),
          run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
          key: 'list',
          Icon: List,
          label: t('markdown.list'),
          active: editor.isActive('bulletList'),
          run: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          key: 'orderedList',
          Icon: ListOrdered,
          label: t('markdown.orderedList'),
          active: editor.isActive('orderedList'),
          run: () => editor.chain().focus().toggleOrderedList().run(),
        },
      ]
    : [];

  return (
    <div className={`mde ${className}`.trim()}>
      <div className="mde__toolbar">
        {tools.map(({ key, Icon, label, active, run }) => (
          <button
            key={key}
            type="button"
            className={`mde__tool${active ? ' mde__tool--active' : ''}`}
            aria-label={label}
            aria-pressed={active}
            title={label}
            onMouseDown={(e) => { e.preventDefault(); run(); }}
          >
            <Icon width={18} height={18} aria-hidden="true" />
          </button>
        ))}
      </div>

      <EditorContent editor={editor} className="mde__area bayn-scroll" />

      {maxLength != null && (
        <div className="mde__foot">
          <span className="mde__count">{count}/{maxLength}</span>
        </div>
      )}
    </div>
  );
}
