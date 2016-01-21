using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using AmpmLib;
using Newtonsoft.Json.Linq;
using System.ComponentModel;

namespace Client
{
    public partial class MainWindow : Window
    {
        private List<object> _Leaks = new List<object>();

        public MainWindow()
        {
            InitializeComponent();
            AppState.Instance.PropertyChanged += Instance_PropertyChanged;
        }

        private void Instance_PropertyChanged(object sender, PropertyChangedEventArgs e)
        {
            if(e.PropertyName == "Config")
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
            Ampm.Info("informational!");
            Ampm.Warn("warning!");
            Ampm.Error("error!");
        }

        private void Event_Click(object sender, RoutedEventArgs e)
        {
            Ampm.LogEvent("app event", "clicked", "button", 2);
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

        /// <summary>
        /// Send mouse data to ampm over OSC.
        /// </summary>
        /// <param name="e"></param>
        protected override void OnMouseMove(MouseEventArgs e)
        {
            Point p = e.GetPosition(this);
            Ampm.UdpEvent("mouse", new { x = p.X, y = p.Y });
            base.OnMouseMove(e);
        }
    }
}
