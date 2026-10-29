import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response, type NextFunction } from "express";

const authRouter = Router();
const cookieName = "dosk_panel_session";
const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function getPanelSecrets() {
  const password = process.env.PANEL_PASSWORD;
  const sessionSecret = process.env.SESSION_SECRET;
  return password && sessionSecret ? { password, sessionSecret } : null;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function sign(expiration: number, secret: string): string {
  return createHmac("sha256", secret)
    .update(`dosk-panel:${expiration}`)
    .digest("base64url");
}

function hasValidSession(req: Request): boolean {
  const secrets = getPanelSecrets();
  const token = req.cookies?.[cookieName];
  if (!secrets || typeof token !== "string") return false;

  const [rawExpiration, suppliedSignature, extra] = token.split(".");
  if (!rawExpiration || !suppliedSignature || extra !== undefined) return false;

  const expiration = Number(rawExpiration);
  if (
    !Number.isSafeInteger(expiration) ||
    expiration <= Date.now() ||
    expiration > Date.now() + sessionLifetimeMs
  ) {
    return false;
  }

  return safeEqual(suppliedSignature, sign(expiration, secrets.sessionSecret));
}

function setSessionCookie(res: Response, req: Request): void {
  const secrets = getPanelSecrets();
  if (!secrets) return;

  const expiration = Date.now() + sessionLifetimeMs;
  res.cookie(cookieName, `${expiration}.${sign(expiration, secrets.sessionSecret)}`, {
    httpOnly: true,
    secure: req.secure,
    sameSite: "strict",
    maxAge: sessionLifetimeMs,
    path: "/",
  });
}

function loginRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || "unknown";
  const now = Date.now();
  const previous = loginAttempts.get(key);
  const current =
    previous && previous.resetAt > now
      ? previous
      : { count: 0, resetAt: now + 15 * 60 * 1000 };

  if (current.count >= 5) {
    res.status(429).json({ error: "Too many login attempts. Try again later." });
    return;
  }

  current.count += 1;
  loginAttempts.set(key, current);
  next();
}

authRouter.get("/auth/session", (req, res) => {
  res.json({
    configured: Boolean(getPanelSecrets()),
    authenticated: hasValidSession(req),
  });
});

authRouter.post("/auth/login", loginRateLimit, (req, res) => {
  const secrets = getPanelSecrets();
  if (!secrets) {
    res.status(503).json({
      error: "Set PANEL_PASSWORD and SESSION_SECRET in the service environment.",
    });
    return;
  }

  const suppliedPassword = req.body?.password;
  if (
    typeof suppliedPassword !== "string" ||
    !safeEqual(suppliedPassword, secrets.password)
  ) {
    res.status(401).json({ error: "Incorrect password." });
    return;
  }

  loginAttempts.delete(req.ip || "unknown");
  setSessionCookie(res, req);
  res.json({ authenticated: true });
});

authRouter.post("/auth/logout", (_req, res) => {
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: _req.secure,
    sameSite: "strict",
    path: "/",
  });
  res.json({ authenticated: false });
});

export function requirePanelAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!getPanelSecrets()) {
    res.status(503).json({
      error: "Panel authentication is not configured.",
    });
    return;
  }
  if (!hasValidSession(req)) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  next();
}

export default authRouter;
