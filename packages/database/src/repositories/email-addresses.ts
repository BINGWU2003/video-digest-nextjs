import type { EmailAddressRow } from "../tables.js";

export type { EmailAddressRow } from "../tables.js";

export type FindDefaultVerifiedEmailAddressForUserInput = {
  /** 邮箱所属用户 ID，来自 Supabase Auth。 */
  userId: string;
};

export type ListEmailAddressesForUserInput = {
  /** 邮箱所属用户 ID，来自 Supabase Auth。 */
  userId: string;
};

export type EnsureVerifiedDefaultEmailAddressForUserInput = {
  /** 邮箱所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 要设为默认收件人的邮箱地址。 */
  email: string;
};

export type SetDefaultVerifiedEmailAddressForUserInput = {
  /** 邮箱记录 ID。 */
  id: string;
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
  /** 查询用户所有收件邮箱。 */
  listForUser(
    input: ListEmailAddressesForUserInput,
  ): Promise<EmailAddressRow[]>;
  /** 查询用户默认且已验证的收件邮箱。 */
  findDefaultVerifiedForUser(
    input: FindDefaultVerifiedEmailAddressForUserInput,
  ): Promise<EmailAddressRow | null>;
  /** 确保指定邮箱是用户默认且已验证的收件邮箱。 */
  ensureVerifiedDefaultForUser(
    input: EnsureVerifiedDefaultEmailAddressForUserInput,
  ): Promise<EmailAddressRow>;
  /** 将已有 verified 邮箱设为默认收件邮箱。 */
  setDefaultVerifiedForUser(
    input: SetDefaultVerifiedEmailAddressForUserInput,
  ): Promise<EmailAddressRow>;
  /** 成功投递后更新默认邮箱最近发送时间。 */
  updateLastSentAt(
    input: UpdateEmailAddressLastSentAtInput,
  ): Promise<EmailAddressRow>;
};
