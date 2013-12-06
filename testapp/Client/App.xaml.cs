using System;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Media;
using System.Windows.Threading;
using Bespoke.Common.Osc;
using Newtonsoft.Json.Linq;

namespace Client
{
    /// <summary>
    /// Example application to excercise the features of stimulant/ampm.
    /// </summary>
    public partial class App : Application
    {
        // This machine's IP.
        private static readonly IPAddress _ClientAddress = Dns.GetHostEntry(Dns.GetHostName()).AddressList.FirstOrDefault(ip => ip.AddressFamily == AddressFamily.InterNetwork);

        // Source object used when sending OSC messages.
        private static readonly IPEndPoint _MessageSource = new IPEndPoint(IPAddress.Loopback, 3003);

        // The OSC server to receive OSC messages.
        private static readonly OscServer _OscReceive = new OscServer(TransportType.Udp, _ClientAddress, 3003) { FilterRegisteredMethods = false, ConsumeParsingExceptions = false };

        // The destination for OSC messages to the local node.js server.
        private static readonly IPEndPoint _OscSendLocal = new IPEndPoint(_ClientAddress, 3004);

        // Timer for picking up dropped connections.
        private static readonly DispatcherTimer _ReconnectTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };

        // Class to create JSON for the server.
        private static readonly JavaScriptSerializer _Serializer = new JavaScriptSerializer();

        public App()
        {
            Startup += App_Startup;

            // Send heartbeats every frame.
            CompositionTarget.Rendering += (sender, e) => SendMessage("heart");

            /*
            // Handle incoming OSC messages.
            _OscReceive.MessageReceived += Server_MessageReceived;
            _OscReceive.Start();

            // Request app state every second, even if we haven't sent a change to it -- this should recover lost connections.
            _ReconnectTimer.Tick += (sender, e) => RefreshState();
            _ReconnectTimer.Start();

            // Whenever the local state changes, send an update to the server.
            ExhibitState.Instance.ChangedLocally += (sender, e) => RefreshState();
             */
        }

        void App_Startup(object sender, StartupEventArgs e)
        {
            Logger.Log.DebugTrace("foo");

            if (e.Args.Length > 0)
            {
                try
                {
                    ExhibitState.Instance.Config = JObject.Parse(e.Args[0]);
                }
                catch
                {
#if DEBUG
                    throw;
#endif
                }
            }
        }

        /// <summary>
        /// Send messages to the local machine and the master.
        /// </summary>
        /// <param name="message"></param>
        private void SendMessage(string type, string message = null)
        {
            message = string.Format("/{0}/{1}/{2}/", type, Environment.MachineName, message);
            new OscMessage(_MessageSource, message).Send(_OscSendLocal);
        }

        /*
        /// <summary>
        /// Update this instance's state on the server and get a refresh.
        /// </summary>
        private void RefreshState()
        {
            AppState state = ExhibitState.Instance.AppStates[Environment.MachineName];
            string json = _Serializer.Serialize(state);
            SendMessage("setState", json);

            _ReconnectTimer.Stop();
            _ReconnectTimer.Start();
            SendMessage("getState");
        }

        /// <summary>
        /// Decode messages from the server.
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        private void Server_MessageReceived(object sender, OscMessageReceivedEventArgs e)
        {
            string[] parts = e.Message.Address.Substring(1).Split(new char[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
            string action = parts[0];
            string hostname = parts[1];
            string message = parts[2];
            JToken token = JObject.Parse(message);
            Dispatcher.BeginInvoke((Action)(() => HandleMessage(action, token)), DispatcherPriority.Input);
        }

        /// <summary>
        /// Do something with messages from the server.
        /// </summary>
        /// <param name="action"></param>
        /// <param name="token"></param>
        private void HandleMessage(string action, JToken token)
        {
            switch (action)
            {
                case "state":
                    dynamic[] clientStates = token.SelectToken("collections.appStates.models").ToObject<dynamic[]>();
                    List<string> hostnames = new List<string>();

                    // For all the client states, decode the JSON and update the state here.
                    foreach (dynamic clientState in clientStates)
                    {
                        string hostname = clientState.attrs.hostname;
                        int x = clientState.attrs.x;
                        int y = clientState.attrs.y;
                        string color = clientState.attrs.color;

                        hostnames.Add(hostname);
                        AppState state = null;
                        ExhibitState.Instance.AppStates.TryGetValue(hostname, out state);
                        if (state == null)
                        {
                            state = ExhibitState.Instance.AppStates[hostname] = new AppState();
                        }

                        state.Point = new Point((double)x, (double)y);

                        string colorName = color;
                        colorName = colorName[0].ToString().ToUpperInvariant() + colorName.Substring(1);
                        state.Color = (Brush)typeof(Brushes).GetProperty(colorName).GetGetMethod().Invoke(null, null);
                    }

                    // Remove any clients that went away.
                    foreach (string client in ExhibitState.Instance.AppStates.Keys.ToList())
                    {
                        if (!hostnames.Contains(client))
                        {
                            // ExhibitState.Instance.AppStates.Remove(client);
                        }
                    }

                    ExhibitState.Instance.FireChangedRemotely();
                    _ReconnectTimer.Stop();
                    _ReconnectTimer.Start();
                    SendMessage("/getAppState/");
                    break;
            }
        }
         */
    }
}
