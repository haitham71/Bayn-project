import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Markdown.css';

// The only elements the description may render — a strict allow-list matching
// the editor's toolbar (bold, italic, headings, bullet/numbered lists,
// paragraphs, line breaks). Anything else — links, images, tables, code,
// blockquotes, strike-through — is stripped, its text kept.
const ALLOWED = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

// Safe Markdown renderer. react-markdown does not render raw HTML unless the
// rehype-raw plugin is added — which we deliberately don't — so any HTML in the
// source is escaped, not executed. On top of that we allow only the elements in
// ALLOWED; everything else is unwrapped to plain text.
export default function Markdown({ children, className = '' }) {
  return (
    <div className={`md ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={ALLOWED}
        unwrapDisallowed
      >
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}
