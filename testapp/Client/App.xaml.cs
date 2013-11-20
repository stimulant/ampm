using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Media;
using System.Windows.Threading;
using Bespoke.Common.Osc;
using Client.Properties;
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
        private static readonly IPEndPoint _MessageSource = new IPEndPoint(IPAddress.Loopback, 3002);

        // The OSC server to receive OSC messages.
        private static readonly OscServer _OscReceive = new OscServer(TransportType.Udp, _ClientAddress, 3002) { FilterRegisteredMethods = false, ConsumeParsingExceptions = false };

        // The destination for OSC messages to the local node.js server.
        private static readonly IPEndPoint _OscSendLocal = new IPEndPoint(_ClientAddress, 3001);

        // The destination for OSC messages to the master node.js server.
        private static readonly IPEndPoint _OscSendMaster = new IPEndPoint(IPAddress.Parse(Settings.Default.MasterServerIp), 3001);

        // Timer for picking up dropped connections.
        private static readonly DispatcherTimer _ReconnectTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };

        // Timer for detecting server outages.
        private static readonly DispatcherTimer _ServerUpTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(5) };

        // Whether this app /should be/ communicating with a master server as well as the local one.
        private static readonly bool _UseLocalServer = true;

        // Whether this app /is/ connecting with a master server as well as the local one.
        private static bool _UsingLocalServer = false;

        // Just don't use a server at all -- for dev only.
        private static bool _Serverless = false;

        // Class to create JSON for the server.
        private static readonly JavaScriptSerializer _Serializer = new JavaScriptSerializer();

        public App()
        {
            // Handle incoming OSC messages.
            _OscReceive.MessageReceived += Server_MessageReceived;
            _OscReceive.Start();

            // Send heartbeats every frame.
            CompositionTarget.Rendering += (sender, e) => SendMessage("/heart/" + DateTime.Now.Millisecond);

            // Request app state every second, even if we haven't sent a change to it -- this should recover lost connections.
            _ReconnectTimer.Tick += (sender, e) => RefreshState();
            _ReconnectTimer.Start();

            _ServerUpTimer.Tick += (sender, e) => _UsingLocalServer = true;

            // Whenever the local state changes, send an update to the server.
            AppState.Instance.ChangedLocally += (sender, e) => RefreshState();
        }

        /// <summary>
        /// Update this instance's state on the server and get a refresh.
        /// </summary>
        private void RefreshState()
        {
            if (_Serverless || _UsingLocalServer || _UseLocalServer)
            {
                // If using the local server, don't bother waiting for an update.
                AppState.Instance.FireChangedRemotely();
            }

            if (_Serverless)
            {
                // If no server, don't bother sending messages.
                return;
            }

            string state = _Serializer.Serialize(AppState.Instance.ClientStates[Environment.MachineName]);
            string message = string.Format("/setClientState/client/{0}/state/{1}", Environment.MachineName, state);
            OscMessage osc = new OscMessage(_MessageSource, message);
            osc.Send(_OscSendMaster);
            osc.Send(_OscSendLocal);

            _ReconnectTimer.Stop();
            _ReconnectTimer.Start();
            SendMessage("/getAppState/");
        }

        /// <summary>
        /// Send messages to the local machine and the master.
        /// </summary>
        /// <param name="message"></param>
        private void SendMessage(string message)
        {
            _ServerUpTimer.Start();
            OscMessage msg = new OscMessage(_MessageSource, message);
            msg.Send(_OscSendMaster);
            msg.Send(_OscSendLocal);
        }

        /// <summary>
        /// Decode messages from the server.
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        private void Server_MessageReceived(object sender, OscMessageReceivedEventArgs e)
        {
            bool fromLocal = e.Message.SourceEndPoint.Address.Equals(_ClientAddress);
            bool ignore = true;

            // Ignore messages from the local server not in standalone mode.
            if (fromLocal && (_UseLocalServer || _UsingLocalServer))
            {
                ignore = false;
            }

            // Ignore messages from the remote server in standalone mode.
            if (!fromLocal && !_UseLocalServer)
            {
                ignore = false;
            }

            if (ignore)
            {
                return;
            }

            if (!fromLocal && _UsingLocalServer)
            {
                _UsingLocalServer = false;
            }

            _ServerUpTimer.Stop();
            string[] parts = e.Message.Address.Substring(1).Split(new char[] { '/' }, 2, StringSplitOptions.RemoveEmptyEntries);
            string action = parts[0];
            string message = parts[1];
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
                case "appState":
                    Dictionary<string, dynamic> clientStates = token.SelectToken("attrs.clientStates").ToObject<Dictionary<string, dynamic>>();

                    // For all the client states, decode the JSON and update the state here.
                    foreach (KeyValuePair<string, dynamic> pair in clientStates)
                    {
                        ClientState state = null;
                        AppState.Instance.ClientStates.TryGetValue(pair.Key, out state);
                        if (state == null)
                        {
                            state = AppState.Instance.ClientStates[pair.Key] = new ClientState();
                        }

                        state.Point = new Point((double)pair.Value.point.x, (double)pair.Value.point.y);

                        if (state.Color == Brushes.Black)
                        {
                            // Only do this once because it probably takes a while -- but could update it every frame if you wanted.
                            try
                            {
                                string colorName = pair.Value.color;
                                colorName = colorName[0].ToString().ToUpperInvariant() + colorName.Substring(1);
                                state.Color = (Brush)typeof(Brushes).GetProperty(colorName).GetGetMethod().Invoke(null, null);
                            }
                            catch
                            {
                            }
                        }
                    }

                    // Remove any clients that went away.
                    foreach (string client in AppState.Instance.ClientStates.Keys.ToList())
                    {
                        if (!clientStates.ContainsKey(client))
                        {
                            AppState.Instance.ClientStates.Remove(client);
                        }
                    }

                    AppState.Instance.FireChangedRemotely();
                    _ReconnectTimer.Stop();
                    _ReconnectTimer.Start();
                    SendMessage("/getAppState/");
                    break;
            }
        }
    }
}
