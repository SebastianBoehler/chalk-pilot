export function SetupShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 lg:px-8">
      <header className="mb-12 flex items-center justify-between">
        <p className="text-lg font-semibold">ChalkPilot</p>
        <p className="text-muted text-sm">Room setup</p>
      </header>
      {children}
    </main>
  );
}
