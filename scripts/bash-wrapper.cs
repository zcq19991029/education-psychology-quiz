using System;
using System.Diagnostics;

public static class BashWrapper
{
    private static string Posix(string value)
    {
        value = value.Replace('\\', '/');
        if (value.Length >= 2 && value[1] == ':')
            return "/" + char.ToLowerInvariant(value[0]) + value.Substring(2);
        return value;
    }

    private static string Quote(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }

    public static int Main(string[] args)
    {
        if (args.Length < 3) return 64;
        // Git Bash on this Windows host decodes Chinese path arguments with the
        // active code page. The verified ASCII junction keeps the same checkout
        // while allowing the packager to read hosting.json and dist reliably.
        var project = "/c/quizsite";
        var command = Quote(Posix(args[0])) + " " + Quote(project) + " " + Quote(Posix(args[2]));
        var info = new ProcessStartInfo
        {
            FileName = @"C:\Program Files\Git\bin\bash.exe",
            Arguments = "-lc " + Quote(command),
            UseShellExecute = false,
        };
        using (var process = Process.Start(info))
        {
            process.WaitForExit();
            return process.ExitCode;
        }
    }
}
