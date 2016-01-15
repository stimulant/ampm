using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Windows.Threading;
using Bespoke.Common.Osc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Quobject.SocketIoClientDotNet.Client;

namespace AmpmLib
{
    /// <summary>
    /// Interface for sending things to ampm.
    /// </summary>
    public static class Ampm
    {
        // The socket to log to the server.
        private static Socket _SocketToServer;
        private static bool _Connected = false;
        private static JObject _Config = null;

        // The destination for OSC messages to the local node.js server.
        private static readonly IPEndPoint _OscSendLocal = new IPEndPoint(IPAddress.Loopback, 3002);

        // Source object used when sending OSC messages.
        private static readonly IPEndPoint _MessageSource = new IPEndPoint(IPAddress.Loopback, 3003);

        // The OSC server to receive OSC messages.
        private static readonly OscServer _OscReceive = new OscServer(TransportType.Udp, IPAddress.Loopback, 3003) { FilterRegisteredMethods = false, ConsumeParsingExceptions = false };

        private static Queue<Tuple<string, object>> _MessageQueue = new Queue<Tuple<string, object>>();

        // The UI dispatcher needs to be set so that data from the websocket can be used by the UI.
        public static Dispatcher Dispatcher { get; set; }

        static Ampm()
        {
            _SocketToServer = IO.Socket("http://localhost:3001");
            _SocketToServer.On(Socket.EVENT_CONNECT, Socket_Opened);
            _SocketToServer.On(Socket.EVENT_DISCONNECT, Socket_Closed);
            _SocketToServer.On(Socket.EVENT_ERROR, Socket_Closed);
            _SocketToServer.On(Socket.EVENT_CONNECT_ERROR, Socket_Closed);
            _SocketToServer.On(Socket.EVENT_DISCONNECT, Socket_Closed);

            // Request the configuration and dispatch it as an event.
            _SocketToServer.On("configRequest", (data) =>
            {
                _Config = JObject.FromObject(data);
                if (ConfigLoaded != null)
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        ConfigLoaded(null, _Config);
                    }));
                }
            });

            // Handle incoming OSC messages.
            _OscReceive.MessageReceived += Server_MessageReceived;
            _OscReceive.Start();
        }

        /// <summary>
        /// When the socket connection is opened, clear out any queue of events/logs.
        /// </summary>
        static void Socket_Opened()
        {
            _Connected = true;

            if (_Config == null)
            {
                _SocketToServer.Emit("configRequest");
            }

            while (_MessageQueue.Count > 0)
            {
                Tuple<string, object> msg = _MessageQueue.Dequeue();
                TcpEvent(msg.Item1, msg.Item2);
            }
        }

        public static event EventHandler<JObject> ConfigLoaded;

        static void Socket_Closed()
        {
            _Connected = false;
            _SocketToServer.Connect();
        }

        /// <summary>
        /// Send a heartbeat message.
        /// </summary>
        public static void Heart()
        {
            UdpEvent("heart");
        }

        /// <summary>
        /// Log a usage event.
        /// </summary>
        /// <param name="category"></param>
        /// <param name="action"></param>
        /// <param name="label"></param>
        /// <param name="value"></param>
        public static void LogEvent(string category = null, string action = null, string label = null, int value = 0)
        {
            TrackEvent e = new TrackEvent { Category = category, Action = action, Label = label, Value = value };
            SendEvent(e);
        }

        private static void LogMessage(EventLevel eventLevel, string message)
        {
            TcpEvent("log", new { level = eventLevel.ToString(), message = message });
        }

        /// <summary>
        /// Log an error.
        /// </summary>
        /// <param name="message"></param>
        public static void Error(string message)
        {
            LogMessage(EventLevel.Error, message);
        }

        /// <summary>
        /// Log a warning.
        /// </summary>
        /// <param name="message"></param>
        public static void Warn(string message)
        {
            LogMessage(EventLevel.Warn, message);
        }

        /// <summary>
        /// Log informational info.
        /// </summary>
        /// <param name="message"></param>
        public static void Info(string message)
        {
            LogMessage(EventLevel.Info, message);
        }

        private static void SendEvent(TrackEvent e)
        {
            TcpEvent("event", e);
        }

        public static void TcpEvent(string name, object data = null)
        {
            if (_Connected && _MessageQueue.Count == 0)
            {
                _SocketToServer.Emit(name, JObject.FromObject(data));
            }
            else
            {
                _MessageQueue.Enqueue(new Tuple<string, object>(name, data));
            }
        }

        public static void UdpEvent(string name, object data = null)
        {
            name = "/" + name;
            if (data == null)
            {
                new OscMessage(_MessageSource, name).Send(_OscSendLocal);
            }
            else
            {
                data = JsonConvert.SerializeObject(data);
                new OscMessage(_MessageSource, name, data).Send(_OscSendLocal);
            }
        }

        private static void Server_MessageReceived(object sender, OscMessageReceivedEventArgs e)
        {
            if (OnAmpmMessage == null)
            {
                return;
            }

            string name = e.Message.Address.Replace("/", string.Empty);
            string json = e.Message.Data.FirstOrDefault() as string;
            JToken data = null;
            if (json != null)
            {
                data = JObject.Parse(json);
            }

            Dispatcher.BeginInvoke(new Action(() =>
            {
                OnAmpmMessage(null, new Tuple<string, JToken>(name, data));
            }));
        }

        public static event EventHandler<Tuple<string, JToken>> OnAmpmMessage;

        private class TrackEvent
        {
            public string Category { get; set; }
            public string Action { get; set; }
            public string Label { get; set; }
            public int Value { get; set; }
        }
    }
}
