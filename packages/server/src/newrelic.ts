import type NewRelic from 'newrelic';

/** The few agent calls this package makes; not exported. */
type Agent = Pick<typeof NewRelic, 'getTraceMetadata' | 'setUserID' | 'shutdown'>;

/**
 * The New Relic agent when the application has it installed, otherwise undefined: `newrelic` is an
 * optional peer dependency, and each call is skipped without it. Any other load error is thrown.
 */
async function load(): Promise<Agent | undefined> {
  try {
    return (await import('newrelic')).default;
  } catch (error) {
    const { code, message } = error as { code?: unknown; message?: unknown };
    if (
      code === 'ERR_MODULE_NOT_FOUND' &&
      typeof message === 'string' &&
      message.includes("'newrelic'")
    )
      return undefined;
    throw error;
  }
}

export const newrelic = await load();
