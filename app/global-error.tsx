'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: '4rem 1rem' }}>
        <h1>500 — Something went wrong</h1>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
