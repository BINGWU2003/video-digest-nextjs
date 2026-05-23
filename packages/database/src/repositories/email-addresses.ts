import type { EmailAddressRow } from "../tables.js";

export type { EmailAddressRow } from "../tables.js";

export type FindDefaultVerifiedEmailAddressForUserInput = {
  /** 邮箱所属用户 ID，来自 Supabase Auth。 */
  userId: string;
};

export type UpdateEmailAddressLastSentAtInput = {
  /** 邮箱记录 ID。 */
  id: string;
  /** 邮箱所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 最近一次成功投递摘要邮件的时间。 */
  lastSentAt: Date;
};

export type EmailAddressesRepository = {
  /** 查询用户默认且已验证的收件邮箱。 */
  findDefaultVerifiedForUser(
    input: FindDefaultVerifiedEmailAddressForUserInput,
  ): Promise<EmailAddressRow | null>;
  /** 成功投递后更新默认邮箱最近发送时间。 */
  updateLastSentAt(
    input: UpdateEmailAddressLastSentAtInput,
  ): Promise<EmailAddressRow>;
};
