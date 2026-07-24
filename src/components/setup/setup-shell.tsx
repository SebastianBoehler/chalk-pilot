export function SetupShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-[calc(100svh-4rem)] max-w-6xl px-5 py-10 lg:px-8">
      {children}
    </main>
  );
}
