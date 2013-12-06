using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Windows;
using Microsoft.Diagnostics.Tracing;

namespace Client
{
    [EventSource(Name = "ampm-app")]
    public sealed class Logger : EventSource
    {
        private static Logger _Log = new Logger();

        [Event(1, Level = EventLevel.Critical, Message = "{0}", Channel = EventChannel.Admin)]
        private void CriticalMessage(string message)
        {
            Installer.EnsureInstall(this);
            WriteEvent(1, message);
        }

        public static void Critical(string message)
        {
            _Log.CriticalMessage(message);
        }

        [Event(2, Level = EventLevel.Error, Message = "{0}", Channel = EventChannel.Admin)]
        private void ErrorMessage(string message)
        {
            Installer.EnsureInstall(this);
            WriteEvent(2, message);
        }

        public static void Error(string message)
        {
            _Log.ErrorMessage(message);
        }

        [Event(3, Level = EventLevel.Informational, Message = "{0}", Channel = EventChannel.Admin)]
        private void InformationalMessage(string message)
        {
            Installer.EnsureInstall(this);
            WriteEvent(3, message);
        }

        public static void Informational(string message)
        {
            _Log.InformationalMessage(message);
        }

        [Event(4, Level = EventLevel.Warning, Message = "{0}", Channel = EventChannel.Admin)]
        private void WarningMessage(string message)
        {
            Installer.EnsureInstall(this);
            WriteEvent(4, message);
        }

        public static void Warning(string message)
        {
            _Log.WarningMessage(message);
        }

        private static class Installer
        {
            private static bool _IsInstalled;

            /// <summary>
            /// Install the ETW manifest if needed.
            /// </summary>
            /// <param name="source"></param>
            public static void EnsureInstall(EventSource source)
            {
                if (_IsInstalled)
                {
                    // It's installed! Cool.
                    return;
                }

                string sourceFolder = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
                string destFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), source.Name);

                // First check: See if the manifest is in the right place and is identical to the most-recently built one.
                string manifestName = string.Format("{0}.{1}.etwManifest.man", Assembly.GetExecutingAssembly().GetName().Name, source.Name);
                string sourceFile = Directory.EnumerateFiles(sourceFolder, manifestName).FirstOrDefault();
                string destFile = Directory.Exists(destFolder) ? Directory.EnumerateFiles(destFolder, manifestName).FirstOrDefault() : null;
                bool filesMatch = destFile != null && File.ReadAllText(sourceFile) == File.ReadAllText(destFile);

                // Second check: See if the ETW is listed in the event publishers list.
                bool published = false;
                if (filesMatch == true)
                {
                    Process process = new Process();
                    process.StartInfo = new ProcessStartInfo("wevtutil.exe", "ep") { UseShellExecute = false, RedirectStandardOutput = true };
                    process.OutputDataReceived += (sender, args) =>
                    {
                        if (args.Data == source.Name)
                        {
                            published = true;
                        }
                    };
                    process.Start();
                    process.BeginOutputReadLine();
                    process.WaitForExit();
                }

                if (filesMatch && published)
                {
                    // Sweet, note that it's installed and go on logging.
                    _IsInstalled = true;
                    return;
                }

                // Do the install.
                try
                {
                    // TODO: Rather than running multiple processes, there might be a slicker way: http://stackoverflow.com/questions/437419/
                    string args;

                    // To be safe, uninstall the manifest already in the target folder.
                    destFile = Directory.Exists(destFolder) ? Directory.EnumerateFiles(destFolder, manifestName).FirstOrDefault() : null;
                    if (destFile != null)
                    {
                        args = string.Format("um {0}", destFile);
                        Process.Start(new ProcessStartInfo("wevtutil.exe", args) { Verb = "runAs" }).WaitForExit();
                    }

                    // Copy our manifest over to the target.
                    if (!Directory.Exists(destFolder))
                    {
                        Directory.CreateDirectory(destFolder);
                    }

                    string destPath = Path.Combine(destFolder, Path.GetFileName(sourceFile));
                    File.Copy(sourceFile, destPath, true);
                    File.Copy(sourceFile.Replace(".man", ".dll"), destPath.Replace(".man", ".dll"), true);

                    // Install the manifest.
                    args = string.Format("im {0} /rf:\"{1}\" /mf:\"{1}\"", destPath, Path.Combine(destFolder, Path.GetFileNameWithoutExtension(destPath) + ".dll"));
                    Process.Start(new ProcessStartInfo("wevtutil.exe", "um" + args.Substring(2)) { Verb = "runAs" }).WaitForExit();
                    Process.Start(new ProcessStartInfo("wevtutil.exe", args) { Verb = "runAs" }).WaitForExit();

                    _IsInstalled = true;
                }
                catch (Exception e)
                {
                    MessageBox.Show(e.Message, "Couldn't install logger.");
                }
            }
        }
    }
}
