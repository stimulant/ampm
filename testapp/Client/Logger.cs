using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Windows;
using Microsoft.Diagnostics.Tracing;

namespace Client
{
    [EventSource(Name = "ampm")]
    public sealed class Logger : EventSource
    {
        public static Logger Log = new Logger();

        [Event(1, Keywords = Keywords.Debug, Message = "DebugMessage: {0}", Channel = EventChannel.Admin)]
        public void DebugTrace(string Message)
        {
            Installer.EnsureInstall(this);
            WriteEvent(1, Message);
        }

        private static class Installer
        {
            private static bool? _IsInstalled = null;

            public static void EnsureInstall(EventSource source)
            {
                if (_IsInstalled == null)
                {
                    Process process = new Process();
                    process.StartInfo = new ProcessStartInfo("wevtutil.exe", "ep") { UseShellExecute = false, RedirectStandardOutput = true };
                    process.OutputDataReceived += (sender, args) =>
                    {
                        if (args.Data == source.Name)
                        {
                            _IsInstalled = true;
                        }
                    };
                    process.Start();
                    process.BeginOutputReadLine();
                    process.WaitForExit();
                }

                if (_IsInstalled == null)
                {
                    _IsInstalled = false;
                }

                if (_IsInstalled == true)
                {
                    return;
                }

                string sourceFolder = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
                string destFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), source.Name);

                try
                {
                    if (Directory.Exists(destFolder))
                    {
                        foreach (string filename in Directory.EnumerateFiles(destFolder, "*.etwManifest.man"))
                        {
                            string commandArgs = string.Format("um {0}", filename);
                            Process.Start(new ProcessStartInfo("wevtutil.exe", commandArgs) { Verb = "runAs" }).WaitForExit();
                        }

                        Directory.Delete(destFolder, true);
                    }

                    Directory.CreateDirectory(destFolder);

                    foreach (string filename in Directory.EnumerateFiles(sourceFolder, "*" + source.Name + "*.etwManifest.???"))
                    {
                        string destPath = Path.Combine(destFolder, Path.GetFileName(filename));
                        File.Copy(filename, destPath, true);
                    }

                    foreach (string filename in Directory.EnumerateFiles(destFolder, "*.etwManifest.man"))
                    {
                        string commandArgs = string.Format("im {0} /rf:\"{1}\" /mf:\"{1}\"", filename, Path.Combine(destFolder, Path.GetFileNameWithoutExtension(filename) + ".dll"));
                        Process.Start(new ProcessStartInfo("wevtutil.exe", "um" + commandArgs.Substring(2)) { Verb = "runAs" }).WaitForExit();
                        Process.Start(new ProcessStartInfo("wevtutil.exe", commandArgs) { Verb = "runAs" }).WaitForExit();
                    }

                    _IsInstalled = true;
                    Thread.Sleep(3000);
                }
                catch (Exception e)
                {
                    MessageBox.Show(e.Message, "Couldn't install logger.");
                }
            }
        }

        public class Keywords
        {
            public const EventKeywords Debug = (EventKeywords)0x0001;
        }
    }
}
