// Generic click-to-copy wrapper: <Copy>`4111 1111 1111 1111`</Copy>
// Copies the rendered text of its children (or the `text` prop when given).
// Icons match Mintlify's code-block copy button (lucide copy/check), always
// visible but dimmed so the affordance also works on touch devices.
//
// Mintlify compiles each imported snippet export independently, so this
// component must stay fully self-contained (no references to other exports
// or module-level constants).
export const Copy = ({ children, text }) => {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleCopy = (event) => {
    const content = event.currentTarget.querySelector("[data-copy-content]");
    const value = (text ?? (content ? content.textContent : "")).trim();
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Copy to clipboard"
      aria-label={text ? `Copy ${text}` : "Copy to clipboard"}
      style={{
        cursor: "pointer",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4em",
        verticalAlign: "middle",
      }}
    >
      <span data-copy-content>{children}</span>
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          opacity: copied ? 1 : hovered ? 0.9 : 0.45,
          transition: "opacity 120ms ease-in-out",
        }}
      >
        {copied ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
        )}
      </span>
    </button>
  );
};
