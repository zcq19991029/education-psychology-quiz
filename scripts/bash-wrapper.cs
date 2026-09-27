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
        var command = Quote(Posix(args[0])) + " " + Quote(Posix(args[1])) + " " + Quote(Posix(args[2]));
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
