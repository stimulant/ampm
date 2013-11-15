using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Threading;
using Bespoke.Common.Osc;
using Client.Properties;
using Newtonsoft.Json.Linq;

namespace Client
{
    public partial class App : Application
    {
        private static readonly IPAddress ClientAddress = Dns.GetHostEntry(Dns.GetHostName()).AddressList.FirstOrDefault(ip => ip.AddressFamily == AddressFamily.InterNetwork);
        private static readonly IPEndPoint MessageSource = new IPEndPoint(IPAddress.Loopback, 3002);
        private static readonly OscServer OscReceive = new OscServer(TransportType.Udp, ClientAddress, 3002);
        private static readonly IPEndPoint OscSendLocal = new IPEndPoint(ClientAddress, 3001);
        private static readonly IPEndPoint OscSendMaster = new IPEndPoint(IPAddress.Parse(Settings.Default.MasterServerIp), 3001);

        private static readonly DispatcherTimer HeartTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1.0 / 60.0) };
        private static readonly DispatcherTimer ConnectTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };

        public App()
        {
            // Send heartbeats every frame.
            HeartTimer.Tick += (sender, e) => SendMessage("/heart/" + DateTime.Now.Millisecond);
            HeartTimer.Start();

            // Request app state every second, even if we haven't sent a change to it -- this should recover lost connections.
            ConnectTimer.Tick += (sender, e) => RefreshState();
            ConnectTimer.Start();

            // Handle incoming OSC messages.
            OscReceive.FilterRegisteredMethods = false;
            OscReceive.ConsumeParsingExceptions = false;
            OscReceive.MessageReceived += Server_MessageReceived;
            OscReceive.Start();

            // Whenever the local state changes, send an update to the server.
            AppState.Instance.ChangedLocally += (sender, e) => RefreshState();
        }

        /// <summary>
        /// Update this instance's state on the server and get a refresh.
        /// </summary>
        void RefreshState()
        {
            string state = new JavaScriptSerializer().Serialize(AppState.Instance.ClientStates[Environment.MachineName]);
            string message = string.Format("/setClientState/client/{0}/state/{1}", Environment.MachineName, state);
            OscMessage osc = new OscMessage(MessageSource, message);
            osc.Send(OscSendMaster);
            osc.Send(OscSendLocal);

            ConnectTimer.Stop();
            ConnectTimer.Start();
            SendMessage("/getAppState/");
        }

        /// <summary>
        /// Send messages to the local machine and the master.
        /// </summary>
        /// <param name="message"></param>
        private void SendMessage(string message)
        {
            OscMessage msg = new OscMessage(MessageSource, message);
            msg.Send(OscSendMaster);
            msg.Send(OscSendLocal);
        }

        /// <summary>
        /// Decode messages from the server.
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        void Server_MessageReceived(object sender, OscMessageReceivedEventArgs e)
        {
            if (e.Message.SourceEndPoint.Address.Equals(ClientAddress))
            {
                // Ignore responses from the local server.
                return;
            }

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
                    foreach (KeyValuePair<string, dynamic> pair in clientStates)
                    {
                        string client = pair.Key;
                        if (!AppState.Instance.ClientStates.ContainsKey(client))
                        {
                            AppState.Instance.ClientStates[client] = new ClientState();
                        }

                        ClientState state = AppState.Instance.ClientStates[client];
                        state.Point = new Point((double)pair.Value.point.x, (double)pair.Value.point.y);
                    }

                    AppState.Instance.FireChangedRemotely();
                    ConnectTimer.Stop();
                    ConnectTimer.Start();
                    SendMessage("/getAppState/");
                    break;
            }
        }
    }
}
