using System;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using Bespoke.Common.Osc;
using Client.Properties;
using Newtonsoft.Json.Linq;

namespace Client
{
    public partial class MainWindow : Window
    {
        private static readonly IPAddress MyIp = Dns.GetHostEntry(Dns.GetHostName()).AddressList.FirstOrDefault(ip => ip.AddressFamily == AddressFamily.InterNetwork);
        private static readonly IPEndPoint Source = new IPEndPoint(IPAddress.Loopback, 3002);
        private static readonly OscServer OscReceive = new OscServer(TransportType.Udp, MyIp, 3002);
        private static readonly IPEndPoint OscSendLocal = new IPEndPoint(MyIp, 3001);
        private static readonly IPEndPoint OscSendMaster = new IPEndPoint(IPAddress.Parse(Settings.Default.MasterServerIp), 3001);

        private static readonly DispatcherTimer HeartTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1.0 / 60.0) };
        private static readonly DispatcherTimer ConnectTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1.0) };

        public MainWindow()
        {
            InitializeComponent();

            // Send heartbeats every frame.
            HeartTimer.Tick += (sender, e) => SendMessage("/heart/" + DateTime.Now.Millisecond);
            HeartTimer.Start();

            // Request app state every second, even if we haven't sent a change to it -- this should recover lost connections.
            ConnectTimer.Tick += (sender, e) => SendMessage("/getAppState/");
            ConnectTimer.Start();

            OscReceive.FilterRegisteredMethods = false;
            OscReceive.ConsumeParsingExceptions = false;
            OscReceive.MessageReceived += Server_MessageReceived;
            OscReceive.Start();
        }

        /// <summary>
        /// Send state changes to the server.
        /// </summary>
        /// <param name="e"></param>
        protected override void OnMouseMove(MouseEventArgs e)
        {
            Point position = e.GetPosition(this);
            SendMessage("/" + string.Join("/", "mouse", "x", position.X, "y", position.Y));
            base.OnMouseMove(e);
        }

        /// <summary>
        /// Whenever a message is received, parse it and pass it to the UI thread.
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        void Server_MessageReceived(object sender, OscMessageReceivedEventArgs e)
        {
            if (e.Message.SourceEndPoint.Address.Equals(MyIp))
            {
                // Ignore responses from the local server.
                return;
            }

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
            ConnectTimer.Stop();
            ConnectTimer.Start();
            SendMessage("/getAppState/");
        }

        /// <summary>
        /// Send messages to both servers.
        /// </summary>
        /// <param name="message"></param>
        private void SendMessage(string message)
        {
            OscMessage msg = new OscMessage(Source, message);
            msg.Send(OscSendMaster);
            msg.Send(OscSendLocal);
        }
    }
}
