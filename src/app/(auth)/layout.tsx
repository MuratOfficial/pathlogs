export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-2xl font-bold">
            P
          </div>
          <h1 className="text-2xl font-bold tracking-tight">PathLogs</h1>
          <p className="mt-1 text-sm text-muted">
            Задачи · ветки · патч-логи · трудозатраты
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
