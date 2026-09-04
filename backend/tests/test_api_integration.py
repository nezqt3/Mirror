import json
import os
import subprocess
import sys

import pytest

RUN_API_INTEGRATION = os.getenv("RUN_API_INTEGRATION") == "1"


@pytest.mark.skipif(not RUN_API_INTEGRATION, reason="set RUN_API_INTEGRATION=1")
def test_real_authenticated_api_pipeline() -> None:
    completed = subprocess.run(
        [sys.executable, "scripts/check_pipeline.py"],
        check=True,
        capture_output=True,
        text=True,
    )
    report = json.loads(completed.stdout)

    assert report["status"] == "completed"
    assert isinstance(report["focus_score"], int)
    assert isinstance(report["rewards"], dict)
    assert "discipline" in report["rewards"]
