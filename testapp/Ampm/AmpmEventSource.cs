using Microsoft.Diagnostics.Tracing;

namespace Ampm
{
    /// <summary>
    /// The EventSource used to write logs to the event viewer.
    /// Heavily dependent on all this stuff:
    /// http://blogs.msdn.com/b/dotnet/archive/2013/12/04/microsoft-diagnostics-tracing-eventsource-is-now-rc-on-nuget-org.aspx
    /// </summary>
    [EventSource(Name = "ampm-app")]
    internal sealed class AmpmEventSource : EventSource
    {
        [Event(1, Level = EventLevel.Critical, Message = "{0}", Channel = EventChannel.Admin)]
        internal void Critical(string message)
        {
            EventSourceInstaller.EnsureInstall(this);
            WriteEvent(1, message);
        }

        [Event(2, Level = EventLevel.Error, Message = "{0}", Channel = EventChannel.Admin)]
        internal void Error(string message)
        {
            EventSourceInstaller.EnsureInstall(this);
            WriteEvent(2, message);
        }

        [Event(3, Level = EventLevel.Informational, Message = "{0}", Channel = EventChannel.Admin)]
        internal void Informational(string message)
        {
            EventSourceInstaller.EnsureInstall(this);
            WriteEvent(3, message);
        }

        [Event(4, Level = EventLevel.Warning, Message = "{0}", Channel = EventChannel.Admin)]
        internal void Warning(string message)
        {
            EventSourceInstaller.EnsureInstall(this);
            WriteEvent(4, message);
        }
    }
}
