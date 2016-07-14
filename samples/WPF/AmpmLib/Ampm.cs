using Bespoke.Common.Osc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using System.Windows.Threading;

namespace AmpmLib
{
    /// <summary>
    /// Interface for sending things to ampm.
    /// </summary>
    public static class Ampm
    {
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
            // Handle incoming OSC messages.
            _OscReceive.MessageReceived += Server_MessageReceived;
            _OscReceive.Start();
        }

        // Get the configuration from ampm.
        public static async Task<JObject> GetConfig(string url = "http://localhost:8888/config")
        {
            try
            {
                WebRequest req = WebRequest.Create(url);
                WebResponse res = await req.GetResponseAsync();
                Stream dataStream = res.GetResponseStream();
                StreamReader reader = new StreamReader(dataStream);
                string responseFromServer = reader.ReadToEnd();
                return JObject.Parse(responseFromServer);
            }
            catch
            {
                return JObject.Parse("{}");
            }
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
            UdpEvent("log", new { level = eventLevel.ToString(), message = message });
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
            UdpEvent("event", e);
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
