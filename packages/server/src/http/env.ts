/** An environment variable that must be set when login is on. */
export function requiredEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name];
  if (!value) throw new Error(`${name} must be set when AUTH_ENABLED=true`);
  return value;
}
