import { useEffect, useRef } from 'react';
import Bold from '@/assets/icons/bold.svg?react';
import Italic from '@/assets/icons/italic.svg?react';
import List from '@/assets/icons/list.svg?react';
import './RichTextEditor.css';

const TOOLS = [
  { cmd: 'bold', Icon: Bold, label: 'Bold' },
  { cmd: 'italic', Icon: Italic, label: 'Italic' },
  { cmd: 'insertUnorderedList', Icon: List, label: 'Bulleted list' },
];

// Plain-text length of an HTML string (for the counter before the editor mounts).
function htmlTextLength(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').length;
}

// Lightweight rich-text field: a Bold / Italic / list toolbar over a
// contentEditable area, styled to match the app's inputs. `value` is HTML.
export default function RichTextEditor({
  value = '',
  onChange,
  placeholder = '',
  maxLength,
  className = '',
}) {
  const ref = useRef(null);

  // Seed the editor once; afterwards it's uncontrolled so the caret stays put.
  useEffect(() => {
    if (ref.current && value && ref.current.innerHTML === '') {
      ref.current.innerHTML = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emit() {
    onChange?.(ref.current?.innerHTML ?? '');
  }

  function exec(cmd) {
    document.execCommand(cmd, false, null);
    ref.current?.focus();
    emit();
  }

  function handleBeforeInput(e) {
    if (maxLength == null) return;
    const len = ref.current?.textContent.length ?? 0;
    if (len >= maxLength && e.inputType?.startsWith('insert')) {
      e.preventDefault();
    }
  }

  const textLen = ref.current ? ref.current.textContent.length : htmlTextLength(value);

  return (
    <div className={`rte ${className}`.trim()}>
      <div className="rte__toolbar">
        {TOOLS.map(({ cmd, Icon, label }) => (
          <button
            key={cmd}
            type="button"
            className="rte__tool"
            aria-label={label}
            title={label}
            onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}
          >
            <Icon width={18} height={18} aria-hidden="true" />
          </button>
        ))}
      </div>

      <div
        ref={ref}
        className="rte__area bayn-scroll"
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        onBeforeInput={handleBeforeInput}
        suppressContentEditableWarning
      />

      {maxLength != null && <p className="rte__count">{textLen}/{maxLength}</p>}
    </div>
  );
}
