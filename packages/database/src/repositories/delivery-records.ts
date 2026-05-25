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
  /** 邮件服务商返回的消息 ID。 */
  providerMessageId?: string | null;
  /** 最近一次服务商事件类型。 */
  providerEventType?: string | null;
  /** 最近一次服务商事件发生时间。 */
  providerEventAt?: Date | null;
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

export type ListDeliveryRecordsForUserInput = {
  /** 投递所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 每页数量。 */
  limit?: number;
  /** 分页偏移。 */
  offset?: number;
};

export type DeliveryRecordListItem = {
  deliveryRecord: DeliveryRecordRow;
  targetEmail: string | null;
  videoRecord: {
    id: string;
    sourceUrl: string;
    title: string | null;
  } | null;
};

export type DeliveryRecordPage = {
  records: DeliveryRecordListItem[];
  total: number;
};

export type UpdateDeliveryRecordStatusByProviderMessageIdInput = {
  /** 邮件服务商返回的消息 ID。 */
  providerMessageId: string;
  /** 投递生命周期状态。 */
  status: DeliveryRecordRow["status"];
  /** 最近一次服务商事件类型。 */
  providerEventType: string;
  /** 最近一次服务商事件发生时间。 */
  providerEventAt: Date;
  /** 投递失败或延迟原因。 */
  errorMessage?: string | null;
  /** 成功发送或送达时间。 */
  sentAt?: Date | null;
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
  /** 查询用户最近的投递记录。 */
  listPageForUser(
    input: ListDeliveryRecordsForUserInput,
  ): Promise<DeliveryRecordPage>;
  /** 根据服务商消息 ID 回写 webhook 事件状态。 */
  updateStatusByProviderMessageId(
    input: UpdateDeliveryRecordStatusByProviderMessageIdInput,
  ): Promise<DeliveryRecordRow | null>;
};
