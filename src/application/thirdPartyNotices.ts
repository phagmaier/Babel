/** Read-only third-party notices port. Native owns the file; no paths cross IPC. */
export type ThirdPartyNoticesResult =
  { status: 'ready'; text: string } | { status: 'unavailable'; reason: string };
export interface ThirdPartyNoticesPort {
  read(): Promise<ThirdPartyNoticesResult>;
}
