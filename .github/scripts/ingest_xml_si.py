#!/usr/bin/env python3
# Copyright 2026 The Spyre-Inference Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Parses spyre-inference's pytest JUnit XML into si_test_runs / si_test_cases /
si_run_properties, and optionally into the shared schema-v2 test_cases / test_case_runs.

`--schema` (or INGEST_SCHEMA) picks the generation. It defaults to v1 because
push-to-clickhouse.yaml gets its v2 rows from torch-spyre's ingest-xml-to-clickhouse action
instead, so writing them here too would put one run's cases in twice. The Jenkins
product-test legs have no such step and already export INGEST_SCHEMA=both, which is why
their results reached v1 only until this script grew the flag.

Usage (called by the GHA workflow):
    python3 ingest_xml_si.py \
        --xml-dir xml_artifacts \
        --workflow "test_each_commit" \
        --branch   "main" \
        --sha      "abcdef1234..." \
        --run-id   "3f2b9c1e-...-uuid" \
        --gha-run-id "12345678" \
        --triggered-at "2026-04-25T14:20:45Z" \
        --pr-number 2271 \
        --platform "x86_64"
"""

import argparse
import os
import platform as _platform
import sys
import uuid
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

from ingest_identity import golden_drift, library_provenance
from lxml import etree
from spyre_clickhouse_ingest import extract_properties, get_client, promote_xpass

# The v2 half of the library, which an image baked against an older torch-spyre pin may not
# have (release-0.5's rev has no drop_older_case_attempts). Soft, because this script runs
# from a baked image: a hard import would take v1 down with v2 over a secondary write.
try:
    from spyre_clickhouse_ingest import (
        case_id_for,
        cases_already_ingested,
        component_of,
        drop_older_case_attempts,
        insert_test_results,
        run_id_for,
        run_id_of,
        source_and_external_run_id,
        tables_present,
        target_database,
    )

    V2_LIBRARY = ""
except ImportError as exc:
    V2_LIBRARY = str(exc)

COMPONENT = "spyre-inference"

# A library that re-keys either of these would give these rows a run_id the orchestrator's
# artifact_results row does not share, so a drift refuses the v2 write rather than orphaning it.
IDENTITY_GOLDENS = (
    ()
    if V2_LIBRARY
    else (
        (
            "run_id_of",
            run_id_of,
            ("gha", "12345", "amd64", "integration"),
            "dab2a67f-14bf-53be-b6e4-fc9642086e47",
        ),
        (
            "case_id_for",
            case_id_for,
            (COMPONENT, "tests.test_spyre", "test_case", []),
            "7c5085a2-b04e-5fa3-8436-0931e4c3e867",
        ),
    )
)

# ---------------------------------------------------------------------------
# si_test_runs / si_test_cases / si_run_properties are provisioned out of
# band; this script never creates them. If they're missing, ingest is a
# silent no-op rather than a failure.
# ---------------------------------------------------------------------------


def tables_exist(client, db: str) -> bool:
    return bool(client.command(f"EXISTS TABLE {db}.si_test_runs"))


# ---------------------------------------------------------------------------
# TEST-RESULT XML parsing
# ---------------------------------------------------------------------------


def classify_testcase(tc_el):
    """Return (status, fail_message, skip_message) for one <testcase>."""
    failure_el = tc_el.find("failure")
    error_el = tc_el.find("error")
    skipped_el = tc_el.find("skipped")

    if error_el is not None:
        msg = (error_el.get("message", "") + "\n" + (error_el.text or "")).strip()
        return "error", msg, ""

    if failure_el is not None:
        ftype = (failure_el.get("type") or "").lower()
        msg = (failure_el.get("message", "") + "\n" + (failure_el.text or "")).strip()
        if "xfail" in ftype:
            return "xpass", msg, ""
        return "failed", msg, ""

    if skipped_el is not None:
        stype = (skipped_el.get("type") or "").lower()
        msg = (skipped_el.get("message") or skipped_el.text or "").strip()
        if "xfail" in stype:
            return "xfail", "", msg
        return "skipped", "", msg

    return "passed", "", ""


def parse_test_xml(xml_path: Path):
    tree = etree.parse(str(xml_path))
    root = tree.getroot()

    suites = root.findall(".//testsuite")
    if not suites:
        print(f"  [warn] No <testsuite> found in {xml_path.name}", file=sys.stderr)
        return None, []

    suite = suites[0]
    suite_attrs = suite.attrib

    ts_str = suite_attrs.get("timestamp", "")
    try:
        triggered_at = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except ValueError:
        triggered_at = datetime.now(UTC)

    raw_cases = []
    for tc in suite.findall(".//testcase"):
        status, fail_msg, skip_msg = classify_testcase(tc)
        properties = extract_properties(tc)
        raw_cases.append(
            {
                "case_id": str(uuid.uuid4()),
                "classname": tc.get("classname", ""),
                "name": tc.get("name", ""),
                "status": status,
                "duration_s": float(tc.get("time", 0) or 0),
                "fail_message": fail_msg,
                "skip_message": skip_msg,
                "properties": properties,
                "_is_bare": (status == "passed"),
                "triggered_at": triggered_at,
            }
        )

    promote_xpass(raw_cases, suite_attrs)

    counts = Counter(c["status"] for c in raw_cases)
    run = {
        "suite_name": suite_attrs.get("name", xml_path.stem),
        "filename": xml_path.name,
        "triggered_at": triggered_at,
        "total_tests": len(raw_cases),
        "passed": counts.get("passed", 0),
        "failed": counts.get("failed", 0) + counts.get("error", 0),
        "skipped": counts.get("skipped", 0),
        "xfail": counts.get("xfail", 0),
        "errors": counts.get("error", 0),
        "xpass": counts.get("xpass", 0),
        "duration_s": float(suite_attrs.get("time", 0) or 0),
    }
    return run, raw_cases


# ---------------------------------------------------------------------------
# ClickHouse insertion
# ---------------------------------------------------------------------------


def insert_run(client, run_id: str, run: dict, args):
    client.insert(
        "si_test_runs",
        [
            [
                run_id,
                args.workflow,
                run["suite_name"],
                run["filename"],
                args.branch,
                (args.sha or "").ljust(40)[:40],
                int(args.pr_number) if args.pr_number.strip() else 0,
                _runner_run_id(args, run_id),
                run["triggered_at"].replace(tzinfo=None),
                run["total_tests"],
                run["passed"],
                run["failed"],
                run["skipped"],
                run["xfail"],
                run["errors"],
                run["xpass"],
                run["duration_s"],
                args.platform,
                args.trigger_type or "unknown",
                args.img_digest,
            ]
        ],
        column_names=[
            "run_id",
            "workflow",
            "suite_name",
            "filename",
            "branch",
            "commit_sha",
            "pr_number",
            "runner_run_id",
            "triggered_at",
            "total_tests",
            "passed",
            "failed",
            "skipped",
            "xfail",
            "errors",
            "xpass",
            "duration_s",
            "platform",
            "test_type",
            "img_digest",
        ],
    )


def insert_cases(client, run_id: str, cases: list[dict], workflow: str = ""):
    if not cases:
        return
    client.insert(
        "si_test_cases",
        [
            [
                run_id,
                c["case_id"],
                c["classname"],
                c["name"],
                c["status"],
                c["duration_s"],
                c["skip_message"][:8192],
                c["fail_message"][:8192],
                c["triggered_at"].replace(tzinfo=None),
                workflow,
            ]
            for c in cases
        ],
        column_names=[
            "run_id",
            "case_id",
            "classname",
            "name",
            "status",
            "duration_s",
            "skip_message",
            "fail_message",
            "triggered_at",
            "workflow",
        ],
    )


def insert_properties(client, run_id: str, cases: list[dict]):
    rows = [
        {
            "run_id": run_id,
            "case_id": c["case_id"],
            "prop_name": pname,
            "prop_value": pvalue,
            "triggered_at": c["triggered_at"],
        }
        for c in cases
        for pname, pvalue in c["properties"]
    ]
    if rows:
        client.insert(
            "si_run_properties",
            [
                [
                    r["run_id"],
                    r["case_id"],
                    r["prop_name"],
                    r["prop_value"],
                    r["triggered_at"].replace(tzinfo=None),
                ]
                for r in rows
            ],
            column_names=[
                "run_id",
                "case_id",
                "prop_name",
                "prop_value",
                "triggered_at",
            ],
        )


# ---------------------------------------------------------------------------
# Schema v2: test_cases + test_case_runs
# ---------------------------------------------------------------------------


def write_v2(client, v2db: str, args, run_id: str, cases: list[dict], source_file: str) -> None:
    """One file's cases into the shared v2 pair, keyed on the derived run_id."""
    if not tables_present(client, v2db):
        print(f"  v2: test_cases/test_case_runs absent in {v2db} — skipped")
        return

    component = component_of(args, COMPONENT)
    tier = (args.trigger_type or "").strip()
    arch = args.platform or ""
    v2_run_id = run_id_for(args, run_id, arch, tier)
    if not v2_run_id:
        # Loud: rows unjoinable to any artifact read downstream as "no tests ran".
        source, external = source_and_external_run_id(args, run_id)
        print(
            f"  [warn] v2 skipped: run_id not derivable (source={source} ext={external!r} "
            f"arch={arch!r} tier={tier!r}); --trigger-type is the field usually missing",
            file=sys.stderr,
        )
        return

    if cases_already_ingested(
        client, v2db, v2_run_id, component, source_file, attempt=args.run_attempt
    ):
        print(f"  v2: already ingested run_id={v2_run_id} — skipping")
        return

    # Before the insert, so a failed delete cannot leave two attempts under one run_id.
    drop_older_case_attempts(client, v2db, v2_run_id, component, source_file, args.run_attempt)
    n = insert_test_results(
        client,
        v2db,
        component,
        v2_run_id,
        cases,
        source_file,
        attempt=args.run_attempt,
    )
    print(f"  v2: {n} test_case_runs under run_id={v2_run_id}")


def resolve_v2_database(args) -> str:
    """The v2 database name, or "" when v2 is off, unavailable or the identity has drifted."""
    if args.schema == "v1":
        return ""
    if V2_LIBRARY:
        print(f"  [warn] spyre-clickhouse-ingest has no v2 writer — v2 skipped: {V2_LIBRARY}")
        return ""
    v2db = target_database()
    if not v2db:
        print("  [warn] --schema asked for v2 but CLICKHOUSE_DB_V2 is unset — v2 skipped")
        return ""
    # The only record of which floating `@main` build minted these ids.
    print(f"  v2 identity: {library_provenance()}")
    drift = golden_drift(IDENTITY_GOLDENS)
    if drift:
        print(
            "::error::v2 skipped — the shared identity library no longer mints the ids this "
            "ingest was built against, so its rows would not join any other writer's: "
            f"{'; '.join(drift)}",
            file=sys.stderr,
        )
        return ""
    return v2db


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def _runner_run_id(args, run_id: str) -> str:
    """This leg's own run id: --gha-run-id when GHA-dispatched, else the same uuid as run_id."""
    raw = (getattr(args, "gha_run_id", "") or "").strip()
    if raw:
        try:
            int(raw)
            return raw
        except (ValueError, TypeError):
            pass
    return run_id


def _threaded_run_id(args) -> str:
    """--run-id when it is a real UUID, else "" so the caller mints one.

    Only a well-formed uuid is honoured: the column is a UUID join key, so any
    other value (a build number, a GHA run id) must be ignored, not stored.
    """
    raw = (getattr(args, "run_id", "") or "").strip()
    try:
        return str(uuid.UUID(raw))
    except (ValueError, AttributeError, TypeError):
        return ""


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xml-dir", default=None)
    parser.add_argument("--xml-file", default=None)
    parser.add_argument("--workflow", default="")
    parser.add_argument("--branch", default="")
    parser.add_argument("--sha", default="")
    parser.add_argument("--run-id", default="")
    parser.add_argument("--gha-run-id", default="")
    parser.add_argument("--triggered-at", default="")
    parser.add_argument("--pr-number", default="")
    parser.add_argument(
        "--trigger-type",
        default="",
        help="Suite tier, e.g. smoke | core | full | trunk | weekly | nightly",
    )
    parser.add_argument(
        "--platform",
        default=_platform.machine() or "",
        help="Hardware platform the SUITE ran on, e.g. x86_64 | s390x | ppc64le.",
    )
    parser.add_argument(
        "--img-digest",
        default="",
        help="Digest of the runner image the suite ran against, if known",
    )
    parser.add_argument(
        "--schema",
        choices=["v1", "v2", "both"],
        default=os.environ.get("INGEST_SCHEMA", "v1"),
        help="Which generation to write: v1 (default, the si_* tables), v2 (the shared "
        "test_cases/test_case_runs pair only), or both. Also settable via INGEST_SCHEMA so a "
        "dispatcher can set it once for every leg. A caller whose workflow already has a "
        "separate v2 ingest step must leave this at v1 -- two writers double a run's cases.",
    )
    parser.add_argument(
        "--component",
        default="",
        help=f"Component stamped on v2 rows, defaulting to {COMPONENT}. It is a test_case_id "
        "hash input, so a wrong value splits one suite's identity in two rather than just "
        "mislabelling it; set it when a cell runs another component's suite through here.",
    )
    parser.add_argument(
        "--jenkins-run-key",
        default="",
        help="This leg's own Jenkins externalizable id, e.g. 'Spyre/component-build#417'. "
        "Hashed into the v2 run_id, which is how the orchestrator's artifact_results row and "
        "these per-case rows join without threading a uuid.",
    )
    parser.add_argument(
        "--run-attempt",
        type=int,
        default=0,
        help="Re-run attempt number, so a newer attempt's cases replace an older one's in v2.",
    )
    return parser


def main():
    args = build_parser().parse_args()

    if args.xml_file:
        xml_root = Path(args.xml_file).parent
        xml_files = [Path(args.xml_file)]
    elif args.xml_dir:
        xml_root = Path(args.xml_dir)
        xml_files = sorted(xml_root.rglob("*.xml"))
    else:
        print("Error: provide --xml-dir or --xml-file")
        sys.exit(1)

    if not xml_files:
        print("No XML files found — nothing to ingest.")
        sys.exit(0)

    print(
        f"Connecting to ClickHouse at "
        f"{os.environ['CLICKHOUSE_HOST']}:{os.environ.get('CLICKHOUSE_PORT', 443)} ..."
    )
    client = get_client()
    client.command("SELECT 1")
    print("Connected.\n")

    write_v1 = args.schema in ("v1", "both")
    db = os.environ.get("CLICKHOUSE_DB", "spyre")
    if write_v1 and not tables_exist(client, db):
        print(f"{db}.si_test_runs does not exist — nothing to ingest into. Silent no-op.")
        sys.exit(0)

    # One client serves both: every v2 statement is qualified with this database name.
    v2db = resolve_v2_database(args)
    v2_failed = []

    total_cases = 0

    for xml_path in xml_files:
        print(f"Processing: {xml_path.name}")

        run, cases = parse_test_xml(xml_path)
        if run is None:
            continue

        # Different suites can independently produce a JUnit XML with the
        # same basename (e.g. GitHub Actions strips the model-key
        # subdirectory when an artifact is a single file), so the path
        # relative to the XML root -- not the bare basename -- is what makes
        # `filename` actually unique for both dedup and storage.
        run["filename"] = str(xml_path.relative_to(xml_root))

        # One run_id per TEST RUN, not per XML file: the dispatching orchestrator generates
        # a uuid and threads it down as --run-id, stamping the SAME value on
        # artifact_results, so the two tables join. `filename` stays the per-file
        # discriminator among the rows that share it. Falls back to a fresh uuid4 when
        # --run-id is absent or not a uuid (standalone / GHA-only run): the rows are still
        # valid, just not linked to an artifact.
        run_id = _threaded_run_id(args) or str(uuid.uuid4())

        # Dedup on (run_id, filename): a re-ingest of the SAME test run must be idempotent,
        # but two distinct runs must never collapse. runner_run_id mirrors run_id for a
        # Jenkins/standalone leg, so it's only an independent signal for a GHA numeric id.
        runner_run_id = _runner_run_id(args, run_id)
        v1_seen = False
        if write_v1:
            existing = client.query(
                "SELECT count() FROM si_test_runs "
                "WHERE run_id = {run_id:String} AND filename = {filename:String}",
                parameters={"run_id": run_id, "filename": run["filename"]},
            )
            if existing.result_rows[0][0] == 0 and runner_run_id and runner_run_id != run_id:
                # A GHA re-ingest mints a fresh uuid4, so fall back to the numeric
                # run id to keep that path idempotent.
                existing = client.query(
                    "SELECT count() FROM si_test_runs WHERE "
                    "runner_run_id = {runner_run_id:String} AND filename = {filename:String}",
                    parameters={"runner_run_id": runner_run_id, "filename": run["filename"]},
                )
            v1_seen = existing.result_rows[0][0] > 0

        print(
            f"  run_id={run_id}  tests={run['total_tests']}  "
            f"passed={run['passed']}  failed={run['failed']}  "
            f"xpass={run['xpass']}  xfail={run['xfail']}  skipped={run['skipped']}"
        )

        if v1_seen:
            # v1 is first-write-wins, but a backfill still has to reach v2's own dedup.
            print(f"  Already ingested — skipping {run['filename']}")
        elif write_v1:
            insert_run(client, run_id, run, args)
            insert_cases(client, run_id, cases, workflow=args.workflow)
            insert_properties(client, run_id, cases)
            total_cases += len(cases)
            print(
                f"  Inserted {len(cases)} test cases + "
                f"{sum(len(c['properties']) for c in cases)} properties"
            )

        if v2db:
            try:
                write_v2(client, v2db, args, run_id, cases, run["filename"])
            except Exception as err:  # noqa: BLE001
                v2_failed.append(run["filename"])
                print(f"  [warn] v2 write failed, v1 unaffected: {err!r}", file=sys.stderr)

    print(f"\nDone. {len(xml_files)} file(s) processed.")
    print(f"  Test cases ingested:  {total_cases}")
    if v2_failed:
        # Non-zero exit would discard the v1 rows' own success; this is the only report.
        print(
            f"  [warn] v2 write FAILED for {len(v2_failed)} file(s): {', '.join(v2_failed)}",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
