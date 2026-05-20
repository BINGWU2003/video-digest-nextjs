import type { UsageEventType, UsageUnit } from "../schema.js";
import type { UsageEventRow } from "../tables.js";

export type { UsageEventRow } from "../tables.js";

export type CreateUsageEventInput = {
  /** 用量所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 关联的视频记录 ID；与单条记录无关的用量事件可为空。 */
  recordId?: string | null;
  /** 被计量的用量事件类型。 */
  eventType: UsageEventType;
  /** 本次事件的计量值，例如 1 次或转写分钟数。 */
  quantity?: number;
  /** `quantity` 的计量单位，例如 count 或 minute。 */
  unit?: UsageUnit;
};

export type UsageEventsRepository = {
  /** 创建一条用量事件，并返回已持久化的数据行。 */
  create(input: CreateUsageEventInput): Promise<UsageEventRow>;
};
