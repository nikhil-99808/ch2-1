"""Round Robin CPU scheduling engine with arrival-time support."""
from collections import deque
from typing import Any


class SchedulerInputError(ValueError):
    pass


def run_round_robin(processes: list[dict[str, Any]], quantum: int | float) -> dict[str, Any]:
    if not processes:
        raise SchedulerInputError("Add at least one process before running the simulation.")
    if not isinstance(quantum, (int, float)) or isinstance(quantum, bool) or quantum <= 0:
        raise SchedulerInputError("Time quantum must be greater than zero.")

    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for i, raw in enumerate(processes):
        pid = str(raw.get("pid", "")).strip()
        activity = str(raw.get("activity", "")).strip() or f"Process {pid or i + 1}"
        arrival = raw.get("arrival", raw.get("arrival_time", 0))
        burst = raw.get("burst", raw.get("burst_time", 0))
        if not pid:
            raise SchedulerInputError(f"Process {i + 1}: ID is required.")
        if pid in seen:
            raise SchedulerInputError(f"Process ID '{pid}' must be unique.")
        seen.add(pid)
        if not isinstance(arrival, (int, float)) or isinstance(arrival, bool) or arrival < 0:
            raise SchedulerInputError(f"Process {pid}: arrival time cannot be negative.")
        if not isinstance(burst, (int, float)) or isinstance(burst, bool) or burst <= 0:
            raise SchedulerInputError(f"Process {pid}: burst time must be greater than zero.")
        normalized.append({
            "pid": pid,
            "activity": activity,
            "arrival": float(arrival),
            "burst": float(burst),
            "remaining": float(burst),
            "first_start": None,
            "completion": None,
            "input_order": i,
        })

    # Stable arrival-time ordering preserves the user's order for simultaneous arrivals.
    incoming = sorted(normalized, key=lambda p: (p["arrival"], p["input_order"]))
    ready: deque[dict[str, Any]] = deque()
    index = 0
    now = 0.0
    gantt: list[dict[str, Any]] = []
    execution_log: list[dict[str, Any]] = []

    def fmt(value: float) -> int | float:
        return int(value) if float(value).is_integer() else round(value, 3)

    while index < len(incoming) or ready:
        while index < len(incoming) and incoming[index]["arrival"] <= now:
            ready.append(incoming[index])
            index += 1

        if not ready:
            # CPU is idle until the next process arrives.
            next_arrival = incoming[index]["arrival"]
            if next_arrival > now:
                gantt.append({"pid": "IDLE", "activity": "CPU Idle", "start": fmt(now), "end": fmt(next_arrival), "duration": fmt(next_arrival - now), "idle": True})
                now = next_arrival
            continue

        current = ready.popleft()
        if current["first_start"] is None:
            current["first_start"] = now
        start = now
        duration = min(float(quantum), current["remaining"])
        now += duration
        current["remaining"] = max(0.0, current["remaining"] - duration)
        finished = current["remaining"] <= 1e-9
        if finished:
            current["remaining"] = 0.0
            current["completion"] = now

        segment = {
            "pid": current["pid"], "activity": current["activity"],
            "start": fmt(start), "end": fmt(now), "duration": fmt(duration),
            "remaining": fmt(current["remaining"]), "completed": finished, "idle": False,
        }
        gantt.append(segment)

        # Enqueue arrivals that occurred during this time slice before re-queueing
        # the pre-empted process, matching FIFO ready-queue semantics.
        while index < len(incoming) and incoming[index]["arrival"] <= now:
            ready.append(incoming[index])
            index += 1
        if not finished:
            ready.append(current)

        execution_log.append({
            "turn": len(execution_log) + 1,
            "pid": current["pid"],
            "start": fmt(start),
            "end": fmt(now),
            "ran_for": fmt(duration),
            "remaining": fmt(current["remaining"]),
            "status": "Completed" if finished else "Re-queued",
            "ready_queue": [p["pid"] for p in ready],
        })

    total_busy = sum(float(p["burst"]) for p in normalized)
    makespan = now
    utilization = (total_busy / makespan * 100) if makespan > 0 else 0.0
    results = []
    for p in normalized:
        completion = float(p["completion"])
        turnaround = completion - float(p["arrival"])
        waiting = turnaround - float(p["burst"])
        response = float(p["first_start"]) - float(p["arrival"])
        results.append({
            "pid": p["pid"], "activity": p["activity"],
            "arrival": fmt(float(p["arrival"])), "burst": fmt(float(p["burst"])),
            "first_start": fmt(float(p["first_start"])),
            "completion": fmt(completion), "turnaround": fmt(turnaround),
            "waiting": fmt(waiting), "response": fmt(response),
        })

    n = len(results)
    averages = {
        "waiting": round(sum(float(r["waiting"]) for r in results) / n, 3),
        "turnaround": round(sum(float(r["turnaround"]) for r in results) / n, 3),
        "response": round(sum(float(r["response"]) for r in results) / n, 3),
    }
    return {
        "quantum": quantum,
        "gantt": gantt,
        "results": results,
        "execution_log": execution_log,
        "averages": averages,
        "total_busy": fmt(total_busy),
        "makespan": fmt(makespan),
        "cpu_utilization": round(utilization, 2),
        "process_count": n,
    }
