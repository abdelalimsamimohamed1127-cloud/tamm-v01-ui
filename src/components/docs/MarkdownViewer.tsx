interface MarkdownViewerProps {
  content: string;
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function simpleMarkdownToHtml(markdown: string) {
  let html = escapeHtml(markdown.trim());

  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Very small list support
  html = html.replace(/^(?:- |\* )(.*)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul class="list-disc pl-5 space-y-1">$1</ul>');

  html = html.replace(/\n\n+/g, "</p><p>");
  html = `<p>${html.replace(/\n/g, "<br />")}</p>`;

  return html;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  const html = simpleMarkdownToHtml(content || "");

  return (
    <div
      className="text-sm leading-relaxed space-y-2"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
