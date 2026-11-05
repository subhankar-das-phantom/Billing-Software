import mongoose, { Document, Model, Schema } from 'mongoose';
import crypto from 'crypto';

export interface IDistributedLockDocument extends Document {
  lockKey: string;
  ownerToken: string | null;
  fencingToken: number;
  acquiredAt: Date | null;
  expiresAt: Date;
  lastHeartbeatAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AcquireLeaseResult {
  acquired: boolean;
  ownerToken?: string;
  fencingToken?: number;
  reason?: string;
  heldBy?: string;
  expiresAt?: Date;
}

export interface IDistributedLockModel extends Model<IDistributedLockDocument> {
  acquireLease(lockKey: string, leaseDurationMs: number): Promise<AcquireLeaseResult>;
  releaseLease(lockKey: string, ownerToken: string): Promise<boolean>;
  heartbeatLease(lockKey: string, ownerToken: string, fencingToken: number, extensionMs: number): Promise<boolean>;
}

const distributedLockSchema = new Schema<IDistributedLockDocument>(
  {
    lockKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    ownerToken: {
      type: String,
      default: null,
    },
    fencingToken: {
      type: Number,
      required: true,
      default: 0,
    },
    acquiredAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    lastHeartbeatAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Acquire a distributed lease with fencing tokens and automatic stale lease recovery.
 * Uses a safe two-step atomic pattern:
 * Step 1: Idempotently initialize the lock record with $setOnInsert.
 * Step 2: Atomically claim if available or expired via findOneAndUpdate.
 */
export async function acquireLease(
  lockKey: string,
  leaseDurationMs: number
): Promise<AcquireLeaseResult> {
  const now = new Date();
  const ownerToken = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + leaseDurationMs);

  // Step 1: Idempotent initialization (safely suppress cold-start duplicate key race)
  try {
    await DistributedLock.updateOne(
      { lockKey },
      {
        $setOnInsert: {
          lockKey,
          ownerToken: null,
          fencingToken: 0,
          acquiredAt: null,
          expiresAt: new Date(0),
          lastHeartbeatAt: null,
        },
      },
      { upsert: true }
    );
  } catch (err: any) {
    if (err?.code !== 11000) {
      throw err;
    }
  }

  // Step 2: Atomic attempt to claim or take over expired lock
  const updated = await DistributedLock.findOneAndUpdate(
    {
      lockKey,
      $or: [
        { ownerToken: null },
        { expiresAt: { $lt: now } },
      ],
    },
    {
      $set: {
        ownerToken,
        acquiredAt: now,
        expiresAt,
        lastHeartbeatAt: now,
      },
      $inc: { fencingToken: 1 },
    },
    { new: true }
  );

  if (updated && updated.ownerToken === ownerToken) {
    return {
      acquired: true,
      ownerToken: updated.ownerToken,
      fencingToken: updated.fencingToken,
      expiresAt: updated.expiresAt,
    };
  }

  // Lock could not be claimed; lookup current holder for diagnostics
  const existing = await DistributedLock.findOne({ lockKey }).lean();
  return {
    acquired: false,
    reason: 'LOCKED_BY_OTHER_WORKER',
    heldBy: existing?.ownerToken || undefined,
    expiresAt: existing?.expiresAt,
  };
}

/**
 * Release an active distributed lease.
 * Only succeeds if the current owner token matches.
 */
export async function releaseLease(
  lockKey: string,
  ownerToken: string
): Promise<boolean> {
  const result = await DistributedLock.updateOne(
    { lockKey, ownerToken },
    {
      $set: {
        ownerToken: null,
        expiresAt: new Date(0),
      },
    }
  );
  return (result.modifiedCount ?? (result as any).nModified ?? 0) > 0;
}

/**
 * Extend an active distributed lease heartbeat.
 * Strictly verifies owner token, fencing token, and that lease has not already expired.
 */
export async function heartbeatLease(
  lockKey: string,
  ownerToken: string,
  fencingToken: number,
  extensionMs: number
): Promise<boolean> {
  const now = new Date();
  const newExpiresAt = new Date(now.getTime() + extensionMs);

  const result = await DistributedLock.updateOne(
    {
      lockKey,
      ownerToken,
      fencingToken,
      expiresAt: { $gt: now },
    },
    {
      $set: {
        expiresAt: newExpiresAt,
        lastHeartbeatAt: now,
      },
    }
  );

  return (result.modifiedCount ?? (result as any).nModified ?? 0) > 0;
}

// Bind statics to schema
distributedLockSchema.statics.acquireLease = acquireLease;
distributedLockSchema.statics.releaseLease = releaseLease;
distributedLockSchema.statics.heartbeatLease = heartbeatLease;

export const DistributedLock = (mongoose.models.DistributedLock as IDistributedLockModel) ||
  mongoose.model<IDistributedLockDocument, IDistributedLockModel>('DistributedLock', distributedLockSchema);

export default DistributedLock;
