import pytest
from backend.app.scheduler import SchedulerInputError, run_round_robin


def sample_processes():
    return [
        {"pid": "P1", "activity": "Student Login", "arrival": 0, "burst": 5},
        {"pid": "P2", "activity": "Load Question / Paper", "arrival": 0, "burst": 4},
        {"pid": "P3", "activity": "Save Answers", "arrival": 0, "burst": 3},
        {"pid": "P4", "activity": "Submit Examination", "arrival": 0, "burst": 2},
        {"pid": "P5", "activity": "Generate Result", "arrival": 0, "burst": 4},
    ]


def test_reference_case_matches_project_guide():
    result = run_round_robin(sample_processes(), 2)
    assert [(x["pid"], x["start"], x["end"]) for x in result["gantt"]] == [
        ("P1", 0, 2), ("P2", 2, 4), ("P3", 4, 6), ("P4", 6, 8),
        ("P5", 8, 10), ("P1", 10, 12), ("P2", 12, 14), ("P3", 14, 15),
        ("P5", 15, 17), ("P1", 17, 18),
    ]
    assert result["averages"]["waiting"] == 10.8
    assert result["averages"]["turnaround"] == 14.4
    assert result["averages"]["response"] == 4.0
    assert result["cpu_utilization"] == 100.0


def test_idle_time_when_first_process_arrives_later():
    result = run_round_robin([{"pid": "A", "arrival": 3, "burst": 2}], 1)
    assert result["gantt"][0]["idle"] is True
    assert result["gantt"][0]["start"] == 0
    assert result["gantt"][0]["end"] == 3
    assert result["cpu_utilization"] == pytest.approx(40.0)


def test_duplicate_ids_are_rejected():
    with pytest.raises(SchedulerInputError, match="unique"):
        run_round_robin([{"pid": "A", "burst": 1}, {"pid": "A", "burst": 2}], 1)


def test_invalid_quantum_is_rejected():
    with pytest.raises(SchedulerInputError):
        run_round_robin([{"pid": "A", "burst": 1}], 0)
