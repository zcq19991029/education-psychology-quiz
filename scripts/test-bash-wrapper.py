import subprocess

command = "bash -x '/c/Users/25466/.codex/plugins/cache/openai-curated-remote/sites/0.1.71/skills/sites-hosting/scripts/package-site.sh' '/c/quizsite' '/c/Users/25466/AppData/Local/Temp/test-package.tar.gz'"
result = subprocess.run([r"C:\Program Files\Git\bin\bash.exe", "-lc", command], capture_output=True)
print("code", result.returncode)
print("out", result.stdout.decode("utf-8", "replace"))
print("err", result.stderr.decode("utf-8", "replace"))
