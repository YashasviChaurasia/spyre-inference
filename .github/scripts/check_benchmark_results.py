#!/usr/bin/env python3
"""
Validate vLLM benchmark results.

Checks that benchmark result JSON files are non-empty and contain non-zero values.
"""

import glob
import json
import logging
import os
import sys
from argparse import Action, ArgumentParser, Namespace
from json.decoder import JSONDecodeError
from logging import info, warning
from typing import Any, Dict, List, Optional

logging.basicConfig(level=logging.INFO)


class ValidateDir(Action):
    def __call__(
        self,
        parser: ArgumentParser,
        namespace: Namespace,
        values: Any,
        option_string: Optional[str] = None,
    ) -> None:
        if os.path.isdir(values):
            setattr(namespace, self.dest, values)
            return

        parser.error(f"{values} is not a valid directory")


def parse_args() -> Any:
    parser = ArgumentParser("Check benchmark results")

    parser.add_argument(
        "--benchmark-results",
        type=str,
        required=True,
        action=ValidateDir,
        help="the directory with the benchmark results",
    )

    parser.add_argument(
        "--strict",
        action="store_true",
        default=False,
        help="exit with code 1 when all benchmark results are zeroed",
    )

    return parser.parse_args()


def read_benchmark_results(filepath: str) -> List[Dict[str, Any]]:
    results = []
    with open(filepath) as f:
        try:
            r = json.load(f)
            if isinstance(r, dict):
                results.append(r)
            elif isinstance(r, list):
                results = r

        except JSONDecodeError:
            f.seek(0)

            # Try JSONEachRow format
            for line in f:
                try:
                    r = json.loads(line)
                    if isinstance(r, dict):
                        results.append(r)
                    elif isinstance(r, list):
                        results.extend(r)
                    else:
                        warning(f"Not a JSON dict or list {line}, skipping")
                        continue

                except JSONDecodeError:
                    warning(f"Invalid JSON {line}, skipping")

    return results


def check_benchmark_results(
    benchmark_results_dir: str, strict: bool = False
) -> Dict[str, List]:
    all_results = {}

    for file in glob.glob(f"{benchmark_results_dir}/*.json"):
        filename = os.path.basename(file)
        results = read_benchmark_results(file)

        if not results or type(results) is not list:
            warning(f"{file} is empty")
            continue

        values = []
        for r in results:
            if (
                "benchmark" not in r
                or "metric" not in r
                or "benchmark_values" not in r["metric"]
                or type(r["metric"]["benchmark_values"]) is not list
            ):
                continue
            values.extend(r["metric"]["benchmark_values"])

        if not values:
            warning(f"Found no PyTorch benchmark results in {file}")
            continue

        if all(v == 0 for v in values):
            warning(f"All PyTorch benchmark results in {file} are zeroed")
            if strict:
                sys.exit(1)
            continue

        info(f"Loading benchmark results from {file}")
        all_results[filename] = r

    return all_results


def main() -> None:
    args = parse_args()

    if not check_benchmark_results(args.benchmark_results, strict=args.strict):
        warning(f"Found no benchmark results in {args.benchmark_results}")
        sys.exit(1)


if __name__ == "__main__":
    main()
