import { signInWithPassword, signUpConfirmed, refreshSession } from "@/lib/gotrue";

const realFetch = global.fetch;

function mockFetchOnce(ok: boolean, body: unknown) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
});
afterEach(() => {
  global.fetch = realFetch;
});

describe("signInWithPassword", () => {
  it("returns tokens + user on success", async () => {
    global.fetch = jest.fn(() =>
      mockFetchOnce(true, {
        access_token: "acc",
        refresh_token: "ref",
        user: { id: "u1", email: "a@b.com" },
      }),
    ) as unknown as typeof fetch;

    const res = await signInWithPassword("a@b.com", "pw");
    expect(res.ok).toBe(true);
    expect(res.tokens).toEqual({ access_token: "acc", refresh_token: "ref" });
    expect(res.user).toEqual({ id: "u1", email: "a@b.com" });
  });

  it("surfaces a friendly error on bad credentials", async () => {
    global.fetch = jest.fn(() =>
      mockFetchOnce(false, { error_description: "Invalid login credentials" }),
    ) as unknown as typeof fetch;

    const res = await signInWithPassword("a@b.com", "wrong");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/invalid login/i);
  });

  it("calls the password grant endpoint with the anon key", async () => {
    const spy: jest.Mock = jest.fn(() =>
      mockFetchOnce(true, { access_token: "a", refresh_token: "r", user: { id: "u", email: "e" } }),
    );
    global.fetch = spy as unknown as typeof fetch;
    await signInWithPassword("e", "p");
    const url = String(spy.mock.calls[0][0]);
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(url).toContain("/auth/v1/token?grant_type=password");
    expect(init.headers).toMatchObject({ apikey: "sb_publishable_test" });
  });
});

describe("refreshSession", () => {
  it("returns new tokens on success", async () => {
    global.fetch = jest.fn(() =>
      mockFetchOnce(true, { access_token: "a2", refresh_token: "r2", user: { id: "u", email: "e" } }),
    ) as unknown as typeof fetch;
    const res = await refreshSession("r1");
    expect(res.ok).toBe(true);
    expect(res.tokens?.access_token).toBe("a2");
  });

  it("fails when the refresh token is rejected", async () => {
    global.fetch = jest.fn(() => mockFetchOnce(false, { error: "invalid" })) as unknown as typeof fetch;
    const res = await refreshSession("bad");
    expect(res.ok).toBe(false);
  });
});

describe("signUpConfirmed", () => {
  it("creates a confirmed user then signs in (two calls)", async () => {
    const spy = jest
      .fn()
      .mockReturnValueOnce(mockFetchOnce(true, { id: "u9" })) // admin create
      .mockReturnValueOnce(
        mockFetchOnce(true, { access_token: "a", refresh_token: "r", user: { id: "u9", email: "n@b.com" } }),
      ); // sign in
    global.fetch = spy as unknown as typeof fetch;

    const res = await signUpConfirmed("n@b.com", "secret6");
    expect(res.ok).toBe(true);
    expect(res.user?.id).toBe("u9");
    expect(spy).toHaveBeenCalledTimes(2);
    expect(String(spy.mock.calls[0][0])).toContain("/auth/v1/admin/users");
  });

  it("reports an already-registered email", async () => {
    global.fetch = jest.fn(() =>
      mockFetchOnce(false, { msg: "A user with this email address has already been registered" }),
    ) as unknown as typeof fetch;
    const res = await signUpConfirmed("dup@b.com", "secret6");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/already registered/i);
  });
});
