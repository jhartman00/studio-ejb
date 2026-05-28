"use client";

// Catches errors thrown in the root layout. Must include its own
// <html> and <body>.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "#faf7f2",
          color: "#2b2620",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ maxWidth: 540, padding: 24 }}>
          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 48,
              margin: "0 0 16px",
              fontWeight: 400,
            }}
          >
            Site is having a moment
          </h1>
          <p style={{ color: "#5a4f44", marginBottom: 24 }}>
            Something broke at the very top of the page. Refreshing usually
            fixes it. If not, message Emma and she will let Jamie know.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#faf7f2",
              color: "#2b2620",
              border: "1px solid #2b2620",
              padding: "12px 24px",
              borderRadius: 4,
              fontSize: 16,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ color: "#5a4f44", fontSize: 13, marginTop: 24 }}>
              Error ref: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
