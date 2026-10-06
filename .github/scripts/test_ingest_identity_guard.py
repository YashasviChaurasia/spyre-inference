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

"""The runtime guard on the shared identity library.

Both v2 writers here install that library from a floating `@main`, so what CI verified and
what the production job resolved are two different snapshots. These tests cover the guard
that closes the gap: the goldens each one carries, and that a drift takes the v2 write out
rather than writing rows nothing can join.
"""

from __future__ import annotations

import importlib.util
import json
import os
import pathlib
import sys
import types

import pytest
from ingest_identity import golden_drift, library_provenance

_SCRIPTS = pathlib.Path(__file__).resolve().parent


def _load(name, **stubs):
    for mod_name, mod in stubs.items():
        sys.modules.setdefault(mod_name, mod)
    spec = importlib.util.spec_from_file_location(name, _SCRIPTS / f"{name}.py")
    m = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(m)
    except ModuleNotFoundError as exc:
        pytest.skip(f"ingest deps unavailable: {exc}")
    return m


@pytest.fixture(scope="module")
def vllm_mod():
    utils = types.ModuleType("utils")
    utils.read_benchmark_results = lambda *a, **k: []
    return _load("ingest_vllm_benchmarks", utils=utils)


@pytest.fixture(scope="module")
def xml_mod():
    return _load("ingest_xml_si")


# --- the goldens each writer carries ----------------------------------------------------


def test_xml_goldens_hold_against_the_installed_library(xml_mod):
    assert golden_drift(xml_mod.IDENTITY_GOLDENS) == []


def test_vllm_goldens_hold_against_the_installed_library(vllm_mod):
    # The tripwire, checked against whatever snapshot is installed here. It is the same
    # constant the job evaluates, so CI cannot pass on goldens the ingest does not use.
    assert golden_drift(vllm_mod.IDENTITY_GOLDENS) == []


def test_every_golden_names_its_function_and_both_values(vllm_mod):
    # The message is the whole output of a drift: it has to say which hash moved and to what,
    # or the on-call reader cannot tell a rename from a re-key. The NAME is a caller-supplied
    # label, not fn.__name__: the library re-exports every identity function as a bound
    # `<Class>.derive`, so introspecting the callable would make every drift message read
    # "derive" and tell the reader nothing.
    (line,) = golden_drift(
        [("run_id_of", vllm_mod.run_id_of, ("gha", "1", "amd64", "perf"), "nope")]
    )
    assert "run_id_of" in line and "nope" in line
    assert str(vllm_mod.run_id_of("gha", "1", "amd64", "perf")) in line


def test_a_renamed_or_re_keyed_function_is_drift(vllm_mod):
    golden = "dab2a67f-14bf-53be-b6e4-fc9642086e47"
    ok = ("gha", "12345", "amd64", "integration")
    rekeyed = ("gha", "12345", "s390x", "integration")
    assert golden_drift([("run_id_of", vllm_mod.run_id_of, ok, golden)]) == []
    assert golden_drift([("run_id_of", vllm_mod.run_id_of, rekeyed, golden)]) != []


# --- provenance -------------------------------------------------------------------------


def test_provenance_is_reported_and_never_raises():
    # Logged on every v2 run, so it must degrade to a string rather than take the ingest out
    # when the metadata is missing (a vendored copy, a path install, a stripped image).
    got = library_provenance()
    assert isinstance(got, str) and got


# --- what a drift costs -----------------------------------------------------------------


class _Client:
    """Accepts every table and records what was sent, keyed by (database, table)."""

    def __init__(self):
        self.sent: dict[tuple, list] = {}

    def command(self, _q):
        return 1

    def query(self, q, parameters=None):
        if "system.columns" in q:
            from spyre_clickhouse_ingest import schema

            cols = schema.TABLES[parameters["t"]].columns
            return types.SimpleNamespace(result_rows=[(c,) for c in cols])
        return types.SimpleNamespace(result_rows=[])

    def insert(self, table, rows, column_names=None, database=None):
        self.sent.setdefault((database, table), []).extend(rows)


def _flat():
    extra = {
        "device": "spyre",
        "arch": "x86_64",
        "hardware_type": "IBM_Spyre",
        "model": "granite",
        "test_name": "latency_tp1_in64_out64",
        "head_sha": "deadbeef",
    }
    return {
        "timestamp": 1,
        "schema_version": "v3",
        "name": "spyre_e2e_benchmark",
        "metric": "avg_latency",
        "actual": 1.5,
        "target": 0.0,
        "repo": "spyre-inference",
        "head_branch": "main",
        "workflow_id": 7,
        "job_id": 9,
        "run_attempt": 1,
        "extra": json.dumps(extra),
    }


def _run_ingest(vllm_mod, monkeypatch, goldens):
    client = _Client()
    monkeypatch.setattr(vllm_mod, "IDENTITY_GOLDENS", goldens)
    monkeypatch.setattr(
        vllm_mod, "clickhouse_connect", types.SimpleNamespace(get_client=lambda **kw: client)
    )
    for k, v in dict(
        CLICKHOUSE_HOST="h",
        CLICKHOUSE_USER="u",
        CLICKHOUSE_PASS="p",
        CLICKHOUSE_DB="spyre",
        CLICKHOUSE_DB_V2="spyre_v2",
    ).items():
        monkeypatch.setitem(os.environ, k, v)
    vllm_mod.insert_to_clickhouse([_flat()], "dab2a67f-14bf-53be-b6e4-fc9642086e47")
    return {db for db, _t in client.sent}


def test_intact_goldens_let_the_v2_write_through(vllm_mod, monkeypatch):
    assert "spyre_v2" in _run_ingest(vllm_mod, monkeypatch, vllm_mod.IDENTITY_GOLDENS)


def test_drift_takes_out_v2_and_leaves_the_flat_tables(vllm_mod, monkeypatch):
    # Refusing is the point: rows minted by a library nobody else is running would be
    # orphans, and an orphan reads downstream as "no perf ran".
    broken = (("run_id_of", vllm_mod.run_id_of, ("gha", "1", "amd64", "perf"), "not-the-id"),)
    written = _run_ingest(vllm_mod, monkeypatch, broken)
    assert "spyre_v2" not in written
    assert None in written, "results_v3 / run_metadata must still be written"


# --- which generation the JUnit ingest writes --------------------------------------------


def _xml_args(xml_mod, **over):
    base = dict(
        schema="v1",
        component="",
        run_id="dab2a67f-14bf-53be-b6e4-fc9642086e47",
        gha_run_id="",
        jenkins_run_key="",
        trigger_type="regression",
        platform="ppc64le",
        run_attempt=0,
    )
    return types.SimpleNamespace(**{**base, **over})


def test_ingest_schema_env_var_selects_the_generation(xml_mod, monkeypatch):
    # The only way the Jenkins legs reach v2: they export INGEST_SCHEMA rather than passing
    # a flag, so an arg-only default would silently leave them on v1.
    monkeypatch.setitem(os.environ, "INGEST_SCHEMA", "both")
    assert xml_mod.build_parser().parse_args([]).schema == "both"
    monkeypatch.delitem(os.environ, "INGEST_SCHEMA", raising=False)
    assert xml_mod.build_parser().parse_args([]).schema == "v1"


def test_the_flags_the_pipeline_greps_for_are_advertised(xml_mod):
    # spyre-frameworks greps --help and drops any flag it does not find, silently: without
    # --component the test_case_id hash splits, without --jenkins-run-key the run_id cannot
    # join artifact_results.
    advertised = {
        action.option_strings[0]
        for action in xml_mod.build_parser()._actions
        if action.option_strings
    }
    assert {"--component", "--jenkins-run-key", "--trigger-type", "--platform"} <= advertised


def test_default_schema_writes_no_v2(xml_mod, monkeypatch):
    # Why v2 is opt-in: push-to-clickhouse.yaml already gets v2 rows from torch-spyre's
    # action, so a second writer here would double every run's cases.
    monkeypatch.setitem(os.environ, "CLICKHOUSE_DB_V2", "spyre_v2")
    assert xml_mod.resolve_v2_database(_xml_args(xml_mod)) == ""
    assert xml_mod.resolve_v2_database(_xml_args(xml_mod, schema="both")) == "spyre_v2"


def test_schema_both_writes_test_case_runs(xml_mod):
    client = _Client()
    cases = [
        {
            "classname": "tests.test_spyre",
            "name": "test_case",
            "status": "passed",
            "duration_s": 0.5,
            "fail_message": "",
            "properties": [],
        }
    ]
    xml_mod.write_v2(
        client, "spyre_v2", _xml_args(xml_mod, schema="both"), "ignored", cases, "junit-x.xml"
    )
    assert ("spyre_v2", "test_case_runs") in client.sent
    assert ("spyre_v2", "test_cases") in client.sent


def test_v2_is_refused_without_a_tier(xml_mod):
    # No tier means no derivable run_id, and an unjoinable row reads as "no tests ran".
    client = _Client()
    xml_mod.write_v2(
        client,
        "spyre_v2",
        _xml_args(xml_mod, schema="both", run_id="", trigger_type=""),
        "not-a-uuid",
        [{"classname": "T", "name": "t", "status": "passed", "duration_s": 0, "properties": []}],
        "junit-x.xml",
    )
    assert client.sent == {}


# The coordinates spyre-frameworks' test_v2_identity_copies.py pins. Normalisation is part of
# the contract, so the last two must collapse to one id: arch folding and case folding both.
RUN_CASES = (
    ("jenkins", "Spyre/component-build#417", "ppc64le", "unit"),
    ("jenkins", "Spyre/component-build#9", "amd64", "integration"),
    ("gha", "123", "X86_64", "Regression"),
    (" GHA ", "123", "x86", "regression"),
)


def test_v2_run_id_matches_the_library_for_every_pinned_coordinate(xml_mod):
    for source, external, arch, tier in RUN_CASES:
        key = "jenkins_run_key" if source.strip().lower() == "jenkins" else "gha_run_id"
        args = _xml_args(xml_mod, run_id="", platform=arch, trigger_type=tier, **{key: external})
        assert xml_mod.run_id_for(args, "unused", arch, tier) == xml_mod.run_id_of(
            source.strip().lower(), external, arch, tier
        )
    assert xml_mod.run_id_of(*RUN_CASES[2]) == xml_mod.run_id_of("gha", "123", "x86", "regression")


def test_schema_v2_alone_writes_no_si_tables(xml_mod, monkeypatch, tmp_path):
    xml = tmp_path / "junit-x.xml"
    xml.write_text(
        '<testsuites><testsuite name="s" failures="0" time="1">'
        '<testcase classname="tests.test_spyre" name="test_case" time="0.5"/>'
        "</testsuite></testsuites>"
    )
    client = _Client()
    monkeypatch.setattr(xml_mod, "get_client", lambda **kw: client)
    monkeypatch.setattr(xml_mod, "tables_exist", lambda *a: True)
    monkeypatch.setitem(os.environ, "CLICKHOUSE_HOST", "h")
    monkeypatch.setitem(os.environ, "CLICKHOUSE_DB_V2", "spyre_v2")
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "ingest_xml_si.py",
            "--xml-file",
            str(xml),
            "--schema",
            "v2",
            "--trigger-type",
            "regression",
            "--platform",
            "ppc64le",
            "--jenkins-run-key",
            "Spyre/component-build#417",
        ],
    )
    xml_mod.main()
    assert {t for _db, t in client.sent} == {"test_cases", "test_case_runs"}


def test_a_threaded_uuid_wins_over_the_derived_coordinate(xml_mod):
    # The GHA path threads one, Jenkins does not; both must reach the same library call.
    threaded = "dab2a67f-14bf-53be-b6e4-fc9642086e47"
    args = _xml_args(xml_mod, run_id=threaded, jenkins_run_key="Spyre/component-build#417")
    assert xml_mod.run_id_for(args, "unused", "ppc64le", "unit") == threaded


def test_a_library_without_the_v2_writer_degrades_to_v1(xml_mod, monkeypatch):
    # The script runs from a baked image whose torch-spyre pin may predate the v2 writer; a
    # hard import would take v1 down with it over a secondary write.
    monkeypatch.setattr(xml_mod, "V2_LIBRARY", "cannot import name 'drop_older_case_attempts'")
    monkeypatch.setitem(os.environ, "CLICKHOUSE_DB_V2", "spyre_v2")
    assert xml_mod.resolve_v2_database(_xml_args(xml_mod, schema="both")) == ""
