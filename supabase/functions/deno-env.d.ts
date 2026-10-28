// Declaraciones mínimas del runtime de Deno para poder verificar tipos con tsc.
declare namespace Deno {
  const env: { get(key: string): string | undefined };
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
}
