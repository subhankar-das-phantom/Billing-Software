import mongoose, { Schema } from 'mongoose';

/**
 * SystemSetting — key/value configuration store.
 *
 * Ensures nothing is hardcoded: trial days, grace days,
 * referral caps, Razorpay keys, etc. are all DB-driven.
 *
 * Examples:
 *   { key: "defaultTrialDays",     value: 30 }
 *   { key: "defaultGraceDays",     value: 7  }
 *   { key: "referralMaxFreeDays",  value: 365 }
 *   { key: "defaultTrialPlan",     value: "professional" }
 */
const systemSettingSchema = new Schema(
  {
    key: {
      type: String,
      required: [true, 'Setting key is required'],
      unique: true,
      trim: true,
      maxlength: [100, 'Key cannot exceed 100 characters'],
    },
    value: {
      type: Schema.Types.Mixed,
      required: [true, 'Setting value is required'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

/**
 * Static helper: get a setting by key with an optional default.
 */
systemSettingSchema.statics.getValue = async function (
  key: string,
  defaultValue?: unknown,
): Promise<unknown> {
  const setting = await this.findOne({ key }).lean();
  return setting ? setting.value : defaultValue;
};

/**
 * Static helper: set a setting by key (upsert).
 */
systemSettingSchema.statics.setValue = async function (
  key: string,
  value: unknown,
  description?: string,
): Promise<void> {
  const update: Record<string, unknown> = { value };
  if (description !== undefined) {
    update.description = description;
  }
  await this.findOneAndUpdate({ key }, { $set: update }, { upsert: true });
};

export default mongoose.model('SystemSetting', systemSettingSchema);
