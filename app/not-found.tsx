import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">404 — Page not found</h1>
      <p className="text-gray-600 dark:text-gray-400">The page you are looking for does not exist.</p>
      <Link href="/" className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white">Back to todos</Link>
    </main>
  );
}
