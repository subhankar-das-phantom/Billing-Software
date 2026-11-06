import mongoose, { ClientSession } from 'mongoose';

/**
 * Execute a unit of work inside a MongoDB ACID transaction.
 * If an existing session is passed, the work participates in that outer transaction.
 * Otherwise, a new session and transaction are created, automatically handling
 * retryable commit errors (TransientTransactionError, WriteConflict) via `withTransaction`.
 */
export async function runInTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
  existingSession?: ClientSession,
): Promise<T> {
  if (existingSession) {
    return await work(existingSession);
  }

  const session = await mongoose.startSession();
  try {
    let result!: T;
    try {
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } catch (txErr: any) {
      // Graceful fallback for standalone MongoDB instances without replica sets (e.g. local tests)
      if (txErr?.message?.includes('replica set member or mongos') || txErr?.code === 20) {
        return await work(session);
      }
      throw txErr;
    }
  } finally {
    await session.endSession();
  }
}

export default runInTransaction;
