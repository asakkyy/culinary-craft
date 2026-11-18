param([Parameter(Mandatory)][string]$LogDirectory)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# Closing the worker's job handle also stops any Gradle, JVM, npm and Vite children.
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class CulinaryDevJob {
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr CreateJobObject(IntPtr attributes, IntPtr name);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetInformationJobObject(IntPtr job, int kind, IntPtr info, uint size);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);

    public static IntPtr Attach() {
        IntPtr job = CreateJobObject(IntPtr.Zero, IntPtr.Zero);
        if (job == IntPtr.Zero) throw new Win32Exception();
        // JOBOBJECT_EXTENDED_LIMIT_INFORMATION, including its pointer-sized fields.
        int size = IntPtr.Size == 8 ? 144 : 112;
        IntPtr data = Marshal.AllocHGlobal(size);
        try {
            Marshal.Copy(new byte[size], 0, data, size);
            Marshal.WriteInt32(data, 16, 0x2000); // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            if (!SetInformationJobObject(job, 9, data, (uint)size)
                || !AssignProcessToJobObject(job, GetCurrentProcess()))
                throw new Win32Exception();
            return job;
        } catch {
            CloseHandle(job);
            throw;
        } finally {
            Marshal.FreeHGlobal(data);
        }
    }
}
'@

function Start-DevChild($directory, $command, $name) {
    $options = @{
        FilePath = "$env:SystemRoot\System32\cmd.exe"
        ArgumentList = "/d /c $command"
        WorkingDirectory = Join-Path $root $directory
        RedirectStandardOutput = Join-Path $LogDirectory "$name.log"
        RedirectStandardError = Join-Path $LogDirectory "$name-error.log"
        NoNewWindow = $true
        PassThru = $true
    }
    Start-Process @options
}

$job = [CulinaryDevJob]::Attach()
try {
    $backend = Start-DevChild 'backend' 'gradlew.bat --no-daemon bootRun' 'backend'
    foreach ($name in 'DB_PASSWORD','SPRING_DATASOURCE_PASSWORD','SPRING_FLYWAY_PASSWORD','JWT_SECRET','ADMIN_PASSWORD','MAIL_PASSWORD') {
        [Environment]::SetEnvironmentVariable($name, $null, 'Process')
    }
    $frontend = Start-DevChild 'frontend' 'npm.cmd run dev -- --strictPort' 'frontend'
    while (-not $backend.HasExited -and -not $frontend.HasExited) {
        Start-Sleep -Milliseconds 500
    }
    [Console]::Error.WriteLine('Backend or frontend exited. See the corresponding log.')
} finally {
    [void][CulinaryDevJob]::CloseHandle($job)
}
