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

export type RequestEmailAddressVerificationForUserInput = {
  /** 邮箱所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 要验证的邮箱地址。 */
  email: string;
  /** 验证 token 的 hash，不保存明文 token。 */
  verificationTokenHash: string;
  /** 验证邮件发送时间。 */
  verificationSentAt: Date;
};

export type VerifyEmailAddressForUserInput = {
  /** 邮箱记录 ID。 */
  id: string;
  /** 邮箱所属用户 ID，来自 Supabase Auth。 */
  userId: string;
  /** 验证 token 的 hash。 */
  verificationTokenHash: string;
  /** token 最早有效发送时间，早于该时间视为过期。 */
  verificationSentAfter: Date;
  /** 完成验证时间。 */
  verifiedAt: Date;
};

export type SetDefaultVerifiedEmailAddressForUserInput = {
  /** 邮箱记录 ID。 */
  id: string;
  /** 邮箱所属用户 ID，来自 Supabase Auth。 */
  userId: string;
};

export type DeleteEmailAddressForUserInput = {
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
  /** 创建或刷新一条待验证邮箱记录。 */
  requestVerificationForUser(
    input: RequestEmailAddressVerificationForUserInput,
  ): Promise<EmailAddressRow>;
  /** 使用验证 token 将邮箱标记为 verified。 */
  verifyForUser(
    input: VerifyEmailAddressForUserInput,
  ): Promise<EmailAddressRow | null>;
  /** 将已有 verified 邮箱设为默认收件邮箱。 */
  setDefaultVerifiedForUser(
    input: SetDefaultVerifiedEmailAddressForUserInput,
  ): Promise<EmailAddressRow>;
  /** 删除用户自己的邮箱记录。 */
  deleteForUser(input: DeleteEmailAddressForUserInput): Promise<void>;
  /** 成功投递后更新默认邮箱最近发送时间。 */
  updateLastSentAt(
    input: UpdateEmailAddressLastSentAtInput,
  ): Promise<EmailAddressRow>;
};
