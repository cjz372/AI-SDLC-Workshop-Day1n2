'use client';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">500 — Something went wrong</h1>
      <p className="text-gray-600 dark:text-gray-400">{error.digest ? `Reference: ${error.digest}` : 'An unexpected error occurred.'}</p>
      <button onClick={reset} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white">Try again</button>
    </main>
  );
}
