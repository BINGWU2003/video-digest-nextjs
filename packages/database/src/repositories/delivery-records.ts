import type { DeliveryRecordRow } from "../tables.js";

export type { DeliveryRecordRow } from "../tables.js";

export type CreateDeliveryRecordInput = {
  /** 关联的视频记录 ID。 */
  recordId: string;
  /** 投递所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 本次投递使用的摘要版本。 */
  summaryId: string | null;
  /** 投递目标类型，MVP 只写 email。 */
  type: DeliveryRecordRow["type"];
  /** 投递目标 ID。邮件投递时指向 email_addresses.id。 */
  targetId: string;
  /** 邮件主题或 webhook 事件标题。 */
  subject: string | null;
};

export type UpdateDeliveryRecordStatusForUserInput = {
  /** 投递记录 ID。 */
  id: string;
  /** 投递所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 投递生命周期状态。 */
  status: DeliveryRecordRow["status"];
  /** 投递失败时的错误说明。 */
  errorMessage?: string | null;
  /** 成功发送时间。 */
  sentAt?: Date | null;
};

export type FindLatestDeliveryRecordForRecordInput = {
  /** 关联的视频记录 ID。 */
  recordId: string;
  /** 投递所属用户 ID，来自 Supabase Auth。 */
  userId: string;
};

export type DeliveryRecordsRepository = {
  /** 创建一条 email/webhook 投递记录，初始状态为 queued。 */
  create(input: CreateDeliveryRecordInput): Promise<DeliveryRecordRow>;
  /** 更新投递记录状态。 */
  updateStatusForUser(
    input: UpdateDeliveryRecordStatusForUserInput,
  ): Promise<DeliveryRecordRow>;
  /** 查询指定视频记录下最新一次投递。 */
  findLatestForRecord(
    input: FindLatestDeliveryRecordForRecordInput,
  ): Promise<DeliveryRecordRow | null>;
};
