import { config } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="footer">
      {config.tipUrl ? (
        <a href={config.tipUrl} target="_blank" rel="noreferrer">
          Tip
        </a>
      ) : (
        <span />
      )}
      <p className="credit">
        <span>Created by</span>
        <a href="https://github.com/glederrey" target="_blank" rel="noreferrer">
          Gael Lederrey
        </a>
        <span>with</span>
        <a href="https://cursor.com" target="_blank" rel="noreferrer">
          Cursor
          <svg className="cursor-mark" viewBox="0 0 466.73 532.09" aria-hidden="true">
            <path
              fill="currentColor"
              d="M457.43 125.94 244.42 2.96c-6.84-3.95-15.28-3.95-22.12 0L9.3 125.94C3.55 129.26 0 135.4 0 142.05v247.99c0 6.65 3.55 12.79 9.3 16.11l213.01 122.98c6.84 3.95 15.28 3.95 22.12 0l213.01-122.98c5.75-3.32 9.3-9.46 9.3-16.11V142.05c0-6.65-3.55-12.79-9.3-16.11ZM444.05 151.99 238.42 508.15c-1.39 2.4-5.06 1.42-5.06-1.36V273.58c0-4.66-2.49-8.97-6.53-11.31L24.87 145.67c-2.4-1.39-1.42-5.06 1.36-5.06h411.26c5.84 0 9.49 6.33 6.56 11.38Z"
            />
          </svg>
        </a>
      </p>
    </footer>
  );
}
