#!/usr/bin/env python3
"""Latency percentiles and error rates from Caddy's JSON access log.

Reads the log Caddy writes to ./logs/caddy (bind-mounted in docker-compose.yaml),
including rolled and gzipped files, and reports p50/p95/p99 and 4xx/5xx rates
over a time window. Percentiles are exact, computed from every logged request
rather than estimated from histogram buckets.

Standard library only, so it runs on the instance's stock python3.

    scripts/caddy_stats.py                  # last hour
    scripts/caddy_stats.py --since 24h
    scripts/caddy_stats.py --since 7d --path /api/
    scripts/caddy_stats.py --json           # machine-readable
"""
from __future__ import annotations

import argparse
import glob
import gzip
import json
import math
import os
import re
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone

DEFAULT_LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logs", "caddy")

UNITS = {"m": 60, "h": 3600, "d": 86400}

NUMERIC_SEGMENT = re.compile(r"/\d+(?=/|$)")


def parse_since(value: str) -> int:
    match = re.fullmatch(r"(\d+)([mhd])", value.strip())
    if not match:
        raise argparse.ArgumentTypeError("use a number and a unit: 30m, 6h, 7d")
    return int(match.group(1)) * UNITS[match.group(2)]


def parse_ts(raw) -> float | None:
    # Caddy's default is epoch seconds as a float; accept ISO 8601 too in case
    # the log encoder's time_format is ever changed.
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
        except ValueError:
            return None
    return None


def route_of(method: str, uri: str) -> str:
    path = uri.split("?", 1)[0]
    if path.startswith("/assets/"):
        path = "/assets/*"
    else:
        path = NUMERIC_SEGMENT.sub("/:id", path)
    return f"{method} {path}"


def log_files(log_dir: str, cutoff: float) -> list[str]:
    files = glob.glob(os.path.join(log_dir, "access*.log")) + glob.glob(
        os.path.join(log_dir, "access*.log.gz")
    )
    # A file last written before the window began can't hold anything in it.
    return sorted(f for f in files if os.path.getmtime(f) >= cutoff)


def read_lines(path: str):
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8", errors="replace") as fh:
        yield from fh


def percentile(sorted_values: list[float], p: float) -> float:
    """Nearest-rank percentile on an already-sorted list."""
    if not sorted_values:
        return math.nan
    rank = max(1, math.ceil(p / 100 * len(sorted_values)))
    return sorted_values[rank - 1]


class Bucket:
    __slots__ = ("durations", "s4xx", "s5xx")

    def __init__(self) -> None:
        self.durations: list[float] = []
        self.s4xx = 0
        self.s5xx = 0

    def add(self, duration: float, status: int) -> None:
        self.durations.append(duration)
        if 400 <= status < 500:
            self.s4xx += 1
        elif status >= 500:
            self.s5xx += 1

    def summary(self) -> dict:
        d = sorted(self.durations)
        n = len(d)
        return {
            "requests": n,
            "p50_ms": percentile(d, 50) * 1000,
            "p95_ms": percentile(d, 95) * 1000,
            "p99_ms": percentile(d, 99) * 1000,
            "max_ms": (d[-1] * 1000) if d else math.nan,
            "rate_4xx": self.s4xx / n if n else 0.0,
            "rate_5xx": self.s5xx / n if n else 0.0,
            "count_5xx": self.s5xx,
        }


def collect(args) -> tuple[dict, dict]:
    now = time.time()
    cutoff = now - args.since
    files = log_files(args.log_dir, cutoff)

    scopes: dict[str, Bucket] = defaultdict(Bucket)
    routes: dict[str, Bucket] = defaultdict(Bucket)
    meta = {"files": len(files), "lines": 0, "skipped": 0, "from": cutoff, "to": now}

    for path in files:
        for line in read_lines(path):
            meta["lines"] += 1
            try:
                entry = json.loads(line)
                req = entry["request"]
                ts = parse_ts(entry["ts"])
                duration = float(entry["duration"])
                status = int(entry["status"])
                uri = req["uri"]
                method = req["method"]
            except (ValueError, KeyError, TypeError):
                meta["skipped"] += 1
                continue

            if ts is None or ts < cutoff:
                continue

            path_only = uri.split("?", 1)[0]
            if args.path and not any(path_only.startswith(p) for p in args.path):
                continue
            if any(path_only.startswith(p) for p in args.exclude):
                continue

            scopes["all"].add(duration, status)
            scopes["/api/*" if path_only.startswith("/api/") else "static & pages"].add(
                duration, status
            )
            routes[route_of(method, uri)].add(duration, status)

    scope_summary = {name: b.summary() for name, b in scopes.items()}
    route_summary = {name: b.summary() for name, b in routes.items()}
    return (scope_summary, route_summary), meta


def fmt_ms(ms: float) -> str:
    if math.isnan(ms):
        return "—"
    if ms >= 1000:
        return f"{ms / 1000:.2f} s"
    if ms >= 10:
        return f"{ms:.0f} ms"
    return f"{ms:.1f} ms"


def fmt_pct(rate: float) -> str:
    return f"{rate * 100:.2f}%"


def fmt_time(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def print_report(scopes: dict, routes: dict, meta: dict, args) -> None:
    rel = os.path.relpath(args.log_dir)
    source = os.path.abspath(args.log_dir) if rel.startswith("..") else rel

    print(f"Caddy access stats  {fmt_time(meta['from'])} → {fmt_time(meta['to'])}")
    print(
        f"source: {source}  "
        f"({meta['files']} file(s), {meta['lines']:,} lines"
        + (f", {meta['skipped']:,} unparseable" if meta["skipped"] else "")
        + ")\n"
    )

    if not scopes:
        print("No requests in this window.")
        return

    header = f"{'scope':<16}{'requests':>10}{'p50':>10}{'p95':>10}{'p99':>10}{'max':>10}{'4xx':>9}{'5xx':>9}"
    print(header)
    print("-" * len(header))
    for name in ("all", "/api/*", "static & pages"):
        if name not in scopes:
            continue
        s = scopes[name]
        print(
            f"{name:<16}{s['requests']:>10,}{fmt_ms(s['p50_ms']):>10}{fmt_ms(s['p95_ms']):>10}"
            f"{fmt_ms(s['p99_ms']):>10}{fmt_ms(s['max_ms']):>10}"
            f"{fmt_pct(s['rate_4xx']):>9}{fmt_pct(s['rate_5xx']):>9}"
        )

    if args.routes > 0:
        top = sorted(routes.items(), key=lambda kv: kv[1]["requests"], reverse=True)[: args.routes]
        width = max(28, max(len(name) for name, _ in top) + 2)
        print(f"\nTop {len(top)} routes by volume")
        sub = f"{'route':<{width}}{'requests':>10}{'p95':>10}{'p99':>10}{'5xx':>8}"
        print(sub)
        print("-" * len(sub))
        for name, s in top:
            print(
                f"{name:<{width}}{s['requests']:>10,}{fmt_ms(s['p95_ms']):>10}"
                f"{fmt_ms(s['p99_ms']):>10}{s['count_5xx']:>8}"
            )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--log-dir", default=DEFAULT_LOG_DIR, help="directory holding access*.log (default: ./logs/caddy)")
    parser.add_argument("--since", type=parse_since, default=parse_since("1h"), help="window to report on: 30m, 6h, 7d (default: 1h)")
    parser.add_argument("--path", action="append", default=[], help="only paths with this prefix; repeatable")
    parser.add_argument("--exclude", action="append", default=[], help="skip paths with this prefix; repeatable")
    parser.add_argument("--routes", type=int, default=10, help="how many top routes to list (0 to hide)")
    parser.add_argument("--json", action="store_true", help="print JSON instead of a table")
    args = parser.parse_args()

    if not os.path.isdir(args.log_dir):
        print(f"No log directory at {args.log_dir}. Is Caddy running with the access log enabled?", file=sys.stderr)
        return 1

    (scopes, routes), meta = collect(args)

    if args.json:
        json.dump({"window": meta, "scopes": scopes, "routes": routes}, sys.stdout, indent=2, default=str)
        print()
    else:
        print_report(scopes, routes, meta, args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
