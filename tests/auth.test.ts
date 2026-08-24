import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionToken,
  hashPassword,
  normalizeUsername,
  PASSWORD_ITERATIONS,
  sessionCookie,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "../app/auth-core.ts";

test("用户名支持中文并按规范统一比较", () => {
  assert.equal(validateUsername("小明_2026"), null);
  assert.equal(normalizeUsername("  Test_User  "), "test_user");
  assert.ok(validateUsername("ab"));
  assert.ok(validateUsername("name-with-dash"));
});

test("密码长度规则明确", () => {
  assert.ok(validatePassword("1234567"));
  assert.equal(validatePassword("12345678"), null);
  assert.ok(validatePassword("a".repeat(73)));
});

test("密码哈希计算次数兼容生产运行环境", () => {
  assert.equal(PASSWORD_ITERATIONS, 100_000);
});

test("密码只保存带盐哈希并可安全验证", async () => {
  const record = await hashPassword("一条可靠的测试密码123");
  assert.notEqual(record.hash, "一条可靠的测试密码123");
  assert.equal(
    await verifyPassword(
      "一条可靠的测试密码123",
      record.hash,
      record.salt,
      record.iterations,
    ),
    true,
  );
  assert.equal(
    await verifyPassword(
      "错误的测试密码123",
      record.hash,
      record.salt,
      record.iterations,
    ),
    false,
  );
});

test("会话令牌随机且 Cookie 禁止脚本读取", () => {
  const first = createSessionToken();
  const second = createSessionToken();
  assert.notEqual(first, second);
  const cookie = sessionCookie(first);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
});
