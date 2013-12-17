
using System;
using System.Collections.Generic;
using Microsoft.Diagnostics.Tracing;

namespace Ampm
{
    /// <summary>
    /// Interface for writing logs to the event viewer.
    /// </summary>
    public static class Logger
    {
        // The event source to log to event viewer.
        private static AmpmEventSource _EventSource = new AmpmEventSource();

        // The socket to log to the server.
        private static SocketIOClient.Client _SocketToServer;

        // Log messages stored while not connected to the server.
        private static Dictionary<EventLevel, List<string>> _LogQueue;

        // Event messages stored while not connected to the server.
        private static List<TrackEvent> _EventQueue;

        static Logger()
        {
            _EventQueue = new List<TrackEvent>();

            _LogQueue = new Dictionary<EventLevel, List<string>> 
            {
                { EventLevel.Error, new List<string>() },
                { EventLevel.Warning, new List<string>() },
                { EventLevel.Informational, new List<string>() }
            };

            _SocketToServer = new SocketIOClient.Client("http://localhost:3001");
            _SocketToServer.Opened += Socket_Opened;
            _SocketToServer.Connect();
            _SocketToServer.SocketConnectionClosed += (sender, e) => _SocketToServer.Connect();
            _SocketToServer.Error += (sender, e) => _SocketToServer.Connect();
        }

        /// <summary>
        /// Log an error.
        /// </summary>
        /// <param name="message"></param>
        public static void Error(string message)
        {
            _EventSource.Error(message);
            SendLog(EventLevel.Error, message);
        }

        /// <summary>
        /// Log a warning.
        /// </summary>
        /// <param name="message"></param>
        public static void Warning(string message)
        {
            _EventSource.Warning(message);
            SendLog(EventLevel.Warning, message);
        }

        /// <summary>
        /// Log informational info.
        /// </summary>
        /// <param name="message"></param>
        public static void Info(string message)
        {
            _EventSource.Info(message);
            SendLog(EventLevel.Informational, message);
        }

        /// <summary>
        /// Log a usage event.
        /// </summary>
        /// <param name="category"></param>
        /// <param name="action"></param>
        /// <param name="label"></param>
        /// <param name="value"></param>
        public static void Event(string category = null, string action = null, string label = null, int value = 0)
        {
            TrackEvent e = new TrackEvent { Category = category, Action = action, Label = label, Value = value };
            SendEvent(e);
        }

        /// <summary>
        /// When the socket connection is opened, clear out any queue of events/logs.
        /// </summary>
        /// <param name="sender"></param>
        /// <param name="e"></param>
        static void Socket_Opened(object sender, EventArgs e)
        {
            foreach (KeyValuePair<EventLevel, List<string>> pair in _LogQueue)
            {
                foreach (string message in pair.Value)
                {
                    SendLog(pair.Key, message);
                }

                pair.Value.Clear();
            }

            foreach (TrackEvent ev in _EventQueue)
            {
                SendEvent(ev);
            }

            _EventQueue.Clear();
        }

        private static void SendLog(EventLevel eventLevel, string message)
        {
            if (_SocketToServer.ReadyState == WebSocket4Net.WebSocketState.Open)
            {
                _SocketToServer.Emit("log", new { level = eventLevel.ToString(), message = message });
            }
            else
            {
                _LogQueue[eventLevel].Add(message);
            }
        }

        private static void SendEvent(TrackEvent e)
        {
            if (_SocketToServer.ReadyState == WebSocket4Net.WebSocketState.Open)
            {
                _SocketToServer.Emit("event", e);
            }
            else
            {
                _EventQueue.Add(e);
            }
        }

        private class TrackEvent
        {
            public string Category { get; set; }
            public string Action { get; set; }
            public string Label { get; set; }
            public int Value { get; set; }
        }
    }
}
