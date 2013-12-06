using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using Microsoft.Diagnostics.Tracing;

namespace Ampm
{
    /// <summary>
    /// Handles the crazy logic required to install an Event Viewer source.
    /// Adapted from: https://www.nuget.org/packages/Microsoft.Diagnostics.Tracing.EventSource.Samples
    /// </summary>
    internal static class EventSourceInstaller
    {
        private static bool _IsInstalled;

        /// <summary>
        /// Install the ETW manifest if needed.
        /// </summary>
        /// <param name="eventSource"></param>
        internal static bool EnsureInstall(EventSource eventSource)
        {
            if (IsInstalled(eventSource))
            {
                return true;
            }

            if (DoInstall(eventSource))
            {
                return IsInstalled(eventSource);
            }

            return false;
        }

        private static bool IsInstalled(EventSource eventSource)
        {
            if (_IsInstalled)
            {
                return _IsInstalled;
            }

            string sourceFolder = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            string destFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), eventSource.Name);

            // First check: See if the manifest is in the right place and is identical to the most-recently built one.
            string manifestName = string.Format("{0}.{1}.etwManifest.man", Assembly.GetExecutingAssembly().GetName().Name, eventSource.Name);
            string sourceFile = Directory.EnumerateFiles(sourceFolder, manifestName).FirstOrDefault();
            string destFile = Directory.Exists(destFolder) ? Directory.EnumerateFiles(destFolder, manifestName).FirstOrDefault() : null;
            bool filesMatch = destFile != null && File.ReadAllText(sourceFile) == File.ReadAllText(destFile);

            // Second check: See if the ETW is listed in the event publishers list.
            bool published = false;
            if (filesMatch == true)
            {
                Process process = new Process
                {
                    StartInfo = new ProcessStartInfo("wevtutil.exe", "ep")
                    {
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        CreateNoWindow = true
                    }
                };

                process.OutputDataReceived += (sender, e) =>
                {
                    if (e.Data == eventSource.Name)
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
                _IsInstalled = true;
            }

            return _IsInstalled;
        }

        /// <summary>
        /// TODO: Rather than running multiple processes, there might be a slicker way: http://stackoverflow.com/questions/437419/
        /// </summary>
        /// <param name="eventSource"></param>
        /// <returns></returns>
        public static bool DoInstall(EventSource eventSource)
        {
            try
            {
                string sourceFolder = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
                string destFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), eventSource.Name);
                string manifestName = string.Format("{0}.{1}.etwManifest.man", Assembly.GetExecutingAssembly().GetName().Name, eventSource.Name);
                string sourceFile = Directory.EnumerateFiles(sourceFolder, manifestName).FirstOrDefault();
                string destFile = Directory.Exists(destFolder) ? Directory.EnumerateFiles(destFolder, manifestName).FirstOrDefault() : null;

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
            }
            catch
            {
                return false;
            }

            return true;
        }
    }
}
