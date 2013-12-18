using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;
using Ampm;

namespace Client
{
    public partial class MainWindow : Window
    {
        private List<object> _Leaks = new List<object>();

        public MainWindow()
        {
            InitializeComponent();

            if (AppState.Instance.Config != null)
            {
                _Config.Text = AppState.Instance.Config.ToString();
            }
        }

        private void Hang_Click(object sender, RoutedEventArgs e)
        {
            while (true)
            {
            }
        }

        private void Log_Click(object sender, RoutedEventArgs e)
        {
            Logger.Info("informational!");
            Logger.Warning("warning!");
            Logger.Error("error!");
        }

        private void Event_Click(object sender, RoutedEventArgs e)
        {
            Logger.Event("app event", "clicked", "button", 2);
        }

        private void Crash_Click(object sender, RoutedEventArgs e)
        {
            dynamic x = null;
            var y = x.bar;
        }

        private void Leak_Click(object sender, RoutedEventArgs e)
        {
            byte[] mem = new byte[1048576 * 100];
            _Leaks.Add(mem);
        }

        [DllImport("kernel32.dll")]
        public static extern bool SetProcessWorkingSetSize(IntPtr proc, int min, int max);

        private void GC_Click(object sender, RoutedEventArgs e)
        {
            _Leaks.Clear();
            GC.Collect();
            GC.WaitForPendingFinalizers();
            GC.Collect();
            GC.WaitForPendingFinalizers();
            SetProcessWorkingSetSize(System.Diagnostics.Process.GetCurrentProcess().Handle, -1, -1);
        }

        private void Slow_Click(object sender, RoutedEventArgs e)
        {
            Thread.Sleep(500);
        }
    }
}
