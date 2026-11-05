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
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export default runInTransaction;
