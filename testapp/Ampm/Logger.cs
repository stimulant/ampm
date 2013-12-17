
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
        private static AmpmEventSource _EventSource = new AmpmEventSource();

        private static SocketIOClient.Client _SocketToServer;

        private static Dictionary<EventLevel, List<string>> _LogQueue;

        private static Dictionary<EventLevel, string> _LevelMap;

        static Logger()
        {
            _LevelMap = new Dictionary<EventLevel, string>
            {
                { EventLevel.Error, "error" },
                { EventLevel.Warning, "warning" },
                { EventLevel.Informational, "info" },
            };

            _LogQueue = new Dictionary<EventLevel, List<string>> 
            {
                { EventLevel.Error, new List<string>() },
                { EventLevel.Warning, new List<string>() },
                { EventLevel.Informational, new List<string>() }
            };

            _SocketToServer = new SocketIOClient.Client("http://localhost:3001");
            _SocketToServer.Opened += Socket_Opened;
            _SocketToServer.Connect();
        }

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
        }

        private static void SendLog(EventLevel eventLevel, string message)
        {
            if (_SocketToServer.ReadyState == WebSocket4Net.WebSocketState.Open)
            {
                _SocketToServer.Emit("log", new { level = _LevelMap[eventLevel], message = message });
            }
            else
            {
                _LogQueue[eventLevel].Add(message);
            }
        }

        public static void Error(string message)
        {
            _EventSource.Error(message);
            SendLog(EventLevel.Error, message);
        }

        public static void Warning(string message)
        {
            _EventSource.Warning(message);
            SendLog(EventLevel.Warning, message);
        }

        public static void Info(string message)
        {
            _EventSource.Info(message);
            SendLog(EventLevel.Informational, message);
        }
    }
}
