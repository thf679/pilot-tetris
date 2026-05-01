#!/usr/bin/env python3
"""Manual entry point for the project-qa tool from the pilot-tetris directory.

The upstream `tool-project-qa/src/cli.py` uses a stub context whose
`get_contract` raises a bare `Exception("not found")`, but the tool only
catches `ToolNotFoundError`. That causes the CLI to crash on first run.

This wrapper:
- Locates the tool-project-qa source (sibling directory or env override).
- Adds it to sys.path.
- Constructs `ProjectQATool` directly with a proper `ToolContext`, so
  optional contracts (telegram-send, logger) are gracefully absent.
- Forwards CLI args to it.

Usage:
    scripts/qa.py --question "How does scoring work?"
    scripts/qa.py --config config/project-qa.yaml --question "..."

Environment:
    TOOL_PROJECT_QA_DIR   Override the path to the tool source.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def find_tool_dir() -> Path:
    override = os.environ.get("TOOL_PROJECT_QA_DIR")
    if override:
        return Path(override).resolve()

    here = Path(__file__).resolve().parent
    project_root = here.parent
    candidates = [
        project_root.parent / "tool-project-qa",
        project_root / "tools" / "project-qa",
    ]
    for c in candidates:
        if (c / "src" / "project_qa.py").is_file():
            return c.resolve()

    sys.stderr.write(
        "qa.py: could not locate tool-project-qa.\n"
        "  Tried: "
        + ", ".join(str(c) for c in candidates)
        + "\n"
        "  Set TOOL_PROJECT_QA_DIR to the tool source directory.\n"
    )
    sys.exit(2)


def load_config(path: Path) -> dict:
    import yaml  # required dependency of tool-project-qa
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="qa")
    parser.add_argument(
        "--config",
        default="config/project-qa.yaml",
        help="Path to project-qa configuration YAML (default: config/project-qa.yaml)",
    )
    parser.add_argument("--question", required=True, help="Question to ask")
    args = parser.parse_args(argv)

    tool_dir = find_tool_dir()
    sys.path.insert(0, str(tool_dir))

    # Imported after sys.path is set up so `from .project_qa import ...` resolves.
    from src.project_qa import ProjectQATool, ToolContext  # type: ignore[import-not-found]

    config_path = Path(args.config).resolve()
    if not config_path.is_file():
        sys.stderr.write(f"qa.py: config file not found: {config_path}\n")
        return 2

    config_data = load_config(config_path)

    # Resolve project_root relative to the *project directory* (the parent of
    # config/), not to the config file itself or the caller's cwd. This lets
    # `project_root: .` in config/project-qa.yaml mean "the project root" no
    # matter where the user runs the script from.
    project_dir = config_path.parent
    if project_dir.name == "config":
        project_dir = project_dir.parent
    if "project_root" in config_data:
        root = Path(config_data["project_root"])
        if not root.is_absolute():
            config_data["project_root"] = str((project_dir / root).resolve())
    else:
        config_data["project_root"] = str(project_dir.resolve())

    tool = ProjectQATool()
    tool.configure(config_data)
    tool.start(ToolContext())  # raises ToolNotFoundError for missing contracts — handled by the tool.

    result = tool.answer(args.question)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
