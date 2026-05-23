import type { VideoRecordStatus } from "../schema.js";
import type { JobEventRow } from "../tables.js";

export type { JobEventRow } from "../tables.js";

export type CreateJobEventInput = {
  /** 关联的视频记录 ID。 */
  recordId: string;
  /** 事件所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 当前事件表示的任务状态或处理阶段。 */
  status: VideoRecordStatus;
  /** 可读的状态说明、失败提示或 worker 日志摘要。 */
  message?: string | null;
  /** 结构化事件元数据，例如创建来源、provider、耗时或重试次数。 */
  metadata?: Record<string, unknown>;
};

export type ListJobEventsForRecordInput = {
  /** 关联的视频记录 ID。 */
  recordId: string;
  /** 事件所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 返回事件数，默认由具体 repository 决定。 */
  limit?: number;
};

export type JobEventsRepository = {
  /** 创建一条任务生命周期事件，并返回已持久化的数据行。 */
  create(input: CreateJobEventInput): Promise<JobEventRow>;
  /** 查询指定记录的任务生命周期事件，默认按发生时间升序。 */
  listForRecord(input: ListJobEventsForRecordInput): Promise<JobEventRow[]>;
};
