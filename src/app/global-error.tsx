"use client";

// Last-resort screen when the root layout itself fails, so no translation context exists:
// both languages, inline styles, nothing that could fail again.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="bn">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 560, margin: "0 auto" }}>
        <h1>কিছু একটা সমস্যা হয়েছে / Something went wrong</h1>
        <p>অনুগ্রহ করে আবার চেষ্টা করুন। / Please try again.</p>
        <button type="button" onClick={reset} style={{ minHeight: 48, padding: "0 20px", fontSize: 16 }}>
          আবার চেষ্টা করুন / Try again
        </button>
      </body>
    </html>
  );
}
