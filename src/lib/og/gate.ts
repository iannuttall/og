import { DurableObject } from "cloudflare:workers";
import type { AppConfig } from "./config";
import { sourceUrlKey } from "./utils";

const TICKET_TTL_MS = 30_000;
const DEFAULT_RESERVE_TIMEOUT_MS = 15_000;

type ReserveBody = {
  config: Pick<
    AppConfig,
    | "browserPoolMax"
    | "maxNewUrlsPerWindow"
    | "maxRendersPerWindow"
    | "perUrlCooldownSeconds"
    | "usageWindowSeconds"
  >;
  url: string;
};

type ReserveDecision =
  | { action: "render"; ticketId: string; urlHash: string }
  | {
      action: "fallback";
      reason: "pool_exhausted" | "render_budget" | "page_limit" | "cooldown";
      retryAfter?: number;
    };

type PageState = {
  firstSeenAt: number;
  lastRenderedAt: number;
};

type PeriodState = {
  periodStartAt: number;
  renders: number;
  newUrls: number;
};

type Ticket = {
  id: string;
  acquiredAt: number;
};

export class RenderGate extends DurableObject<Cloudflare.Env> {
  private active = new Map<string, Ticket>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/reserve") {
      const timeoutMs = Number(
        request.headers.get("x-timeout-ms") ?? DEFAULT_RESERVE_TIMEOUT_MS,
      );
      const body = (await request
        .json()
        .catch(() => null)) as ReserveBody | null;
      if (!body) {
        return Response.json({ error: "invalid_body" }, { status: 400 });
      }
      const decision = await this.reserve(
        body,
        Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_RESERVE_TIMEOUT_MS,
      );
      return Response.json(decision, {
        status: decision.action === "render" ? 200 : 429,
      });
    }

    if (request.method === "POST" && url.pathname === "/release") {
      const ticketId = request.headers.get("x-ticket-id") ?? "";
      return Response.json({ released: this.release(ticketId) });
    }

    if (request.method === "GET" && url.pathname === "/stats") {
      return Response.json({
        active: this.active.size,
      });
    }

    return new Response("not found", { status: 404 });
  }

  private async reserve(
    body: ReserveBody,
    timeoutMs: number,
  ): Promise<ReserveDecision> {
    this.sweepExpired();

    const now = Date.now();
    const urlHash = await sourceUrlKey(body.url);
    const pageKey = `page:${urlHash}`;
    const page = await this.ctx.storage.get<PageState>(pageKey);
    const cooldownMs = body.config.perUrlCooldownSeconds * 1000;

    if (
      page?.lastRenderedAt &&
      cooldownMs > 0 &&
      now - page.lastRenderedAt < cooldownMs
    ) {
      return {
        action: "fallback",
        reason: "cooldown",
        retryAfter: Math.ceil(
          (cooldownMs - (now - page.lastRenderedAt)) / 1000,
        ),
      };
    }

    const periodStartAt =
      Math.floor(now / (body.config.usageWindowSeconds * 1000)) *
      body.config.usageWindowSeconds *
      1000;
    const periodKey = `period:${periodStartAt}`;
    const period =
      (await this.ctx.storage.get<PeriodState>(periodKey)) ??
      ({
        periodStartAt,
        renders: 0,
        newUrls: 0,
      } satisfies PeriodState);

    if (period.renders >= body.config.maxRendersPerWindow) {
      return {
        action: "fallback",
        reason: "render_budget",
        retryAfter: Math.ceil(
          (periodStartAt + body.config.usageWindowSeconds * 1000 - now) / 1000,
        ),
      };
    }

    if (!page && period.newUrls >= body.config.maxNewUrlsPerWindow) {
      return {
        action: "fallback",
        reason: "page_limit",
        retryAfter: Math.ceil(
          (periodStartAt + body.config.usageWindowSeconds * 1000 - now) / 1000,
        ),
      };
    }

    if (this.active.size >= body.config.browserPoolMax) {
      return {
        action: "fallback",
        reason: "pool_exhausted",
        retryAfter: Math.ceil(timeoutMs / 1000),
      };
    }

    const ticket = {
      id: crypto.randomUUID(),
      acquiredAt: now,
    };
    this.active.set(ticket.id, ticket);

    await this.ctx.storage.put(periodKey, {
      ...period,
      renders: period.renders + 1,
      newUrls: page ? period.newUrls : period.newUrls + 1,
    } satisfies PeriodState);
    await this.ctx.storage.put(pageKey, {
      firstSeenAt: page?.firstSeenAt ?? now,
      lastRenderedAt: now,
    } satisfies PageState);

    return { action: "render", ticketId: ticket.id, urlHash };
  }

  private release(ticketId: string): boolean {
    if (!ticketId) return false;
    return this.active.delete(ticketId);
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [id, ticket] of this.active) {
      if (now - ticket.acquiredAt > TICKET_TTL_MS) {
        this.active.delete(id);
      }
    }
  }
}

export async function reserveRender(params: {
  env: Cloudflare.Env;
  url: string;
  config: AppConfig;
}): Promise<ReserveDecision> {
  const stub = params.env.RENDER_GATE.getByName("global");
  const response = await stub.fetch("https://render-gate/reserve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-timeout-ms": String(DEFAULT_RESERVE_TIMEOUT_MS),
    },
    body: JSON.stringify({
      url: params.url,
      config: {
        browserPoolMax: params.config.browserPoolMax,
        maxNewUrlsPerWindow: params.config.maxNewUrlsPerWindow,
        maxRendersPerWindow: params.config.maxRendersPerWindow,
        perUrlCooldownSeconds: params.config.perUrlCooldownSeconds,
        usageWindowSeconds: params.config.usageWindowSeconds,
      },
    } satisfies ReserveBody),
  });

  return (await response.json()) as ReserveDecision;
}

export async function releaseRender(params: {
  env: Cloudflare.Env;
  ticketId: string;
}): Promise<void> {
  const stub = params.env.RENDER_GATE.getByName("global");
  await stub.fetch("https://render-gate/release", {
    method: "POST",
    headers: {
      "x-ticket-id": params.ticketId,
    },
  });
}
