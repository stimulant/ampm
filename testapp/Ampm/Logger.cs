
namespace Ampm
{
    /// <summary>
    /// Interface for writing logs to the event viewer.
    /// </summary>
    public static class Logger
    {
        private static AmpmEventSource _EventSource = new AmpmEventSource();

        public static void Critical(string message)
        {
            _EventSource.Critical(message);
        }

        public static void Error(string message)
        {
            _EventSource.Error(message);
        }

        public static void Info(string message)
        {
            _EventSource.Info(message);
        }

        public static void Warning(string message)
        {
            _EventSource.Warning(message);
        }
    }
}
