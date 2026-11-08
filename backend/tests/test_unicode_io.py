"""Check the worker's real stream setup without loading the provider SDK."""
import ast
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest


class UnicodeIOTests(unittest.TestCase):
    def test_multilingual_results_and_prompts_with_legacy_default_encoding(self):
        source = ast.parse(
            (Path(__file__).parents[1] / "python_script.py").read_text(encoding="utf-8")
        )
        setup = []
        for node in source.body:
            if isinstance(node, ast.For) and isinstance(node.target, ast.Name) and node.target.id == "_stream":
                setup.append(node)
            elif isinstance(node, ast.Expr) and ast.unparse(node).startswith("sys.stdout.reconfigure("):
                setup.append(node)
            elif isinstance(node, ast.FunctionDef) and node.name == "_output_result":
                setup.append(node)
        script = "import sys, json\n" + ast.unparse(ast.Module(body=setup, type_ignores=[]))
        script += '\nvalue = json.load(sys.stdin)\nsys.stderr.write(value["transcript"])\n_output_result(value)\n'
        value = {"transcript": "ไทยประกันชีวิต — สวัสดี, 日本語, Filipino: kumusta 👋"}
        result = subprocess.run(
            [sys.executable, "-c", script],
            input=json.dumps(value, ensure_ascii=False).encode("utf-8"),
            capture_output=True,
            env={**os.environ, "PYTHONIOENCODING": "cp1252", "PYTHONUTF8": "0"},
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr.decode("utf-8"), value["transcript"])
        self.assertEqual(json.loads(result.stdout.decode("utf-8").removeprefix("__RESULT__")), value)


if __name__ == "__main__":
    unittest.main()
