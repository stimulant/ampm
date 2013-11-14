using System;
using System.Net;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using Bespoke.Common.Osc;
using Newtonsoft.Json.Linq;

namespace Client
{
    public partial class MainWindow : Window
    {
        private static readonly IPEndPoint Source = new IPEndPoint(IPAddress.Loopback, 2999);
        private static readonly IPEndPoint Destination = new IPEndPoint(IPAddress.Loopback, 3001);
        private static readonly OscServer Server = new OscServer(TransportType.Udp, IPAddress.Loopback, 3002);
        private static readonly DispatcherTimer Timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1.0 / 60.0) };

        public MainWindow()
        {
            InitializeComponent();
            Timer.Tick += Timer_Tick;
            Timer.Start();

            Server.FilterRegisteredMethods = false;
            Server.ConsumeParsingExceptions = false;
            Server.MessageReceived += Server_MessageReceived;
            Server.Start();

            Loaded += MainWindow_Loaded;
        }

        /// <summary>
        /// Send a heartbeat every frame.
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        void Timer_Tick(object sender, EventArgs e)
        {
            OscMessage message = new OscMessage(Source, "/heart/" + DateTime.Now.Millisecond);
            message.Send(Destination);
        }

        /// <summary>
        /// Get the initial app state.
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            OscMessage message = new OscMessage(Source, "/getAppState/");
            message.Send(Destination);
        }

        /// <summary>
        /// Send state changes to the server.
        /// </summary>
        /// <param name="e"></param>
        protected override void OnMouseMove(MouseEventArgs e)
        {
            Point position = e.GetPosition(this);
            new OscMessage(Source, "/" + string.Join("/", "mouse", "x", position.X, "y", position.Y)).Send(Destination);
            base.OnMouseMove(e);
        }

        /// <summary>
        /// Whenever a message is received, parse it and pass it to the UI thread.
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        void Server_MessageReceived(object sender, OscMessageReceivedEventArgs e)
        {
            string[] parts = e.Message.Address.Substring(1).Split(new char[] { '/' }, 2, StringSplitOptions.RemoveEmptyEntries);
            string action = parts[0];
            string data = parts[1];
            dynamic token = JObject.Parse(data);
            Dispatcher.BeginInvoke((Action)(() => HandleMessage(token)), DispatcherPriority.Input);
        }

        /// <summary>
        /// Do something with the message and then request state again.
        /// </summary>
        /// <param name="token"></param>
        private void HandleMessage(dynamic token)
        {
            _Cursor.RenderTransform = new TranslateTransform { X = token.attrs.x - _Cursor.Width / 2, Y = token.attrs.y - _Cursor.Height / 2 };

            OscMessage message = new OscMessage(Source, "/getAppState/");
            message.Send(Destination);
        }
    }
}
