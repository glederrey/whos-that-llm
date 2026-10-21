import { config } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-inner">
      {config.tipUrl ? (
        <a className="kofi" href={config.tipUrl} target="_blank" rel="noreferrer">
          <svg className="kofi-mark" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M11.351 2.715c-2.7 0-4.986.025-6.83.26C2.078 3.285 0 5.154 0 8.61c0 3.506.182 6.13 1.585 8.493 1.584 2.701 4.233 4.182 7.662 4.182h.83c4.209 0 6.494-2.234 7.637-4a9.5 9.5 0 0 0 1.091-2.338C21.792 14.688 24 12.22 24 9.208v-.415c0-3.247-2.13-5.507-5.792-5.87-1.558-.156-2.65-.208-6.857-.208m0 1.947c4.208 0 5.09.052 6.571.182 2.624.311 4.13 1.584 4.13 4v.39c0 2.156-1.792 3.844-3.87 3.844h-.935l-.156.649c-.208 1.013-.597 1.818-1.039 2.546-.909 1.428-2.545 3.064-5.922 3.064h-.805c-2.571 0-4.831-.883-6.078-3.195-1.09-2-1.298-4.155-1.298-7.506 0-2.181.857-3.402 3.012-3.714 1.533-.233 3.559-.26 6.39-.26m6.547 2.287c-.416 0-.65.234-.65.546v2.935c0 .311.234.545.65.545 1.324 0 2.051-.754 2.051-2s-.727-2.026-2.052-2.026m-10.39.182c-1.818 0-3.013 1.48-3.013 3.142 0 1.533.858 2.857 1.949 3.897.727.701 1.87 1.429 2.649 1.896a1.47 1.47 0 0 0 1.507 0c.78-.467 1.922-1.195 2.623-1.896 1.117-1.039 1.974-2.364 1.974-3.897 0-1.662-1.247-3.142-3.039-3.142-1.065 0-1.792.545-2.338 1.298-.493-.753-1.246-1.298-2.312-1.298"
            />
          </svg>
          <span>The API bill is winning, a little help?</span>
        </a>
      ) : (
        <p className="kofi">The models invoice the developer. A Ko-fi will sit here when you feel like covering a round.</p>
      )}
      <p className="credit">
        One human, two AIs:{" "}
        <a href="https://github.com/glederrey" target="_blank" rel="noreferrer">
          <svg className="claude-mark" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M8 5h8v5H8zM4 11h16v5H4zM7 16h3v4H7zM14 16h3v4h-3zM10 6.5h1.5v2H10zM12.5 6.5H14v2h-1.5z" />
          </svg>
          Gael Lederrey
        </a>
        ,{" "}
        <a href="https://cursor.com" target="_blank" rel="noreferrer">
          <svg className="cursor-mark" viewBox="0 0 466.73 532.09" aria-hidden="true">
            <path fill="currentColor" d="M457.43 125.94 244.42 2.96c-6.84-3.95-15.28-3.95-22.12 0L9.3 125.94C3.55 129.26 0 135.4 0 142.05v247.99c0 6.65 3.55 12.79 9.3 16.11l213.01 122.98c6.84 3.95 15.28 3.95 22.12 0l213.01-122.98c5.75-3.32 9.3-9.46 9.3-16.11V142.05c0-6.65-3.55-12.79-9.3-16.11ZM444.05 151.99 238.42 508.15c-1.39 2.4-5.06 1.42-5.06-1.36V273.58c0-4.66-2.49-8.97-6.53-11.31L24.87 145.67c-2.4-1.39-1.42-5.06 1.36-5.06h411.26c5.84 0 9.49 6.33 6.56 11.38Z" />
          </svg>
          Cursor
        </a>{" "}
        and{" "}
        <a href="https://claude.com/product/claude-code" target="_blank" rel="noreferrer">
          <svg className="claude-mark" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" />
          </svg>
          Claude Code
        </a>
      </p>
      </div>
    </footer>
  );
}
