import subprocess
import sys


def to_posix(value: str) -> str:
    value = value.replace("\\", "/")
    if len(value) >= 2 and value[1] == ":":
        return "/" + value[0].lower() + value[2:]
    return value


args = sys.argv[1:]
if len(args) < 3:
    raise SystemExit("bash wrapper expects script, project, and archive paths")
script, project, archive = (to_posix(value) for value in args[:3])
command = "\"{}\" \"{}\" \"{}\"".format(script, project, archive)
git_bash = r"C:\Program Files\Git\bin\bash.exe"
raise SystemExit(subprocess.call([git_bash, "-lc", command]))
