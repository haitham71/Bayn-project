import DOMPurify from 'dompurify';
import Markdown from './Markdown';

// Descriptions authored before the Markdown switch are stored as HTML. We no
// longer render that HTML with its formatting — it's flattened to plain text
// (block tags become line breaks, everything else is dropped) so no legacy
// markup is ever shown formatted. Everything new is Markdown.
const LEGACY_HTML_RE =
  /<\/?(p|div|br|b|i|strong|em|u|ul|ol|li|span|h[1-6]|a|blockquote|pre|code)\b[^>]*>/i;

function htmlToPlainText(html) {
  const withBreaks = html
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  // Strip every tag and attribute, keeping only the text content.
  return DOMPurify.sanitize(withBreaks, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

export default function DescriptionView({ value, className = '' }) {
  const text = value || '';
  if (LEGACY_HTML_RE.test(text)) {
    return (
      <div
        className={`md md--plain ${className}`.trim()}
        dangerouslySetInnerHTML={{ __html: htmlToPlainText(text) }}
      />
    );
  }
  return <Markdown className={className}>{text}</Markdown>;
}
