using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
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
        public void DebugTrace(string message)
        {
            Installer.EnsureInstall(this);
            WriteEvent(1, message);
        }

        public class Keywords
        {
            public const EventKeywords Debug = (EventKeywords)0x0001;
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
                bool filesMatch = destFile != null && FilesAreEqual(new FileInfo(sourceFile), new FileInfo(destFile));

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

                    // Install the manifest.
                    args = string.Format("im {0} /rf:\"{1}\" /mf:\"{1}\"", destPath, Path.Combine(destFolder, Path.GetFileNameWithoutExtension(destPath) + ".dll"));
                    Process.Start(new ProcessStartInfo("wevtutil.exe", "um" + args.Substring(2)) { Verb = "runAs" }).WaitForExit();
                    Process.Start(new ProcessStartInfo("wevtutil.exe", args) { Verb = "runAs" }).WaitForExit();

                    _IsInstalled = true;
                    Thread.Sleep(3000);
                }
                catch (Exception e)
                {
                    MessageBox.Show(e.Message, "Couldn't install logger.");
                }
            }

            private const int _BytesToRead = sizeof(Int64);

            /// <summary>
            /// http://stackoverflow.com/a/1359947/468472
            /// </summary>
            /// <param name="first"></param>
            /// <param name="second"></param>
            /// <returns></returns>
            static bool FilesAreEqual(FileInfo first, FileInfo second)
            {
                if (first.Length != second.Length)
                    return false;

                int iterations = (int)Math.Ceiling((double)first.Length / _BytesToRead);

                using (FileStream fs1 = first.OpenRead())
                using (FileStream fs2 = second.OpenRead())
                {
                    byte[] one = new byte[_BytesToRead];
                    byte[] two = new byte[_BytesToRead];

                    for (int i = 0; i < iterations; i++)
                    {
                        fs1.Read(one, 0, _BytesToRead);
                        fs2.Read(two, 0, _BytesToRead);

                        if (BitConverter.ToInt64(one, 0) != BitConverter.ToInt64(two, 0))
                            return false;
                    }
                }

                return true;
            }
        }
    }
}
