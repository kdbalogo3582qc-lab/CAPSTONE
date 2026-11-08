import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
// Collected by the running server, not by a test. No model calls or credentials.
// Use the same Python executable as the analysis worker.
const python = process.env.PYTHON_EXECUTABLE || (process.platform === 'win32' ? 'py' : 'python3');
const script = `import sys,json,subprocess,importlib.metadata
versions = {}
for name in ('numpy','google-genai','ffmpeg-python'):
    try: versions[name] = importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError: versions[name] = 'unavailable'
try: versions['ffmpeg'] = subprocess.check_output(['ffmpeg','-version'], text=True, timeout=3).splitlines()[0]
except Exception: versions['ffmpeg'] = 'unavailable'
versions['python'] = sys.version
print(json.dumps(versions))`;
let runtime;
try { runtime = JSON.parse(execFileSync(python, ['-c', script], { encoding: 'utf8', timeout: 7000, stdio: ['ignore', 'pipe', 'pipe'] })); }
catch { runtime = { status: 'unknown', process_scope: randomUUID() }; }
export const analysisRuntime = runtime;
