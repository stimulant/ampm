using System;
using System.Windows;
using System.Windows.Media;
using AmpmLib;
using Newtonsoft.Json.Linq;

namespace Client
{
    /// <summary>
    /// Example application to exercise the features of stimulant/ampm.
    /// </summary>
    public partial class App : Application
    {
        public App()
        {
            Ampm.Dispatcher = Dispatcher;
            Startup += App_Startup;

            // Send heartbeats every frame.
            CompositionTarget.Rendering += (sender, e) => Ampm.Heart();

            // Log crashes.
            DispatcherUnhandledException += (sender, e) =>
            {
                Ampm.Error(e.Exception.Message + Environment.NewLine + e.Exception.StackTrace);
                Application.Current.MainWindow.Close();
            };
            AppDomain.CurrentDomain.UnhandledException += (sender, e) =>
            {
                Exception exception = e.ExceptionObject as Exception;
                Ampm.Error(exception == null ? e.ToString() : exception.Message + Environment.NewLine + exception.StackTrace);
                Application.Current.MainWindow.Close();
            };
        }

        // Parse the configuration argument.
        async void App_Startup(object sender, StartupEventArgs e)
        {
            AppState.Instance.Config = await Ampm.GetConfig();
        }
    }
}
