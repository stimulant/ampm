using System;

public sealed class EventLevel
{
    private readonly String name;
    private readonly int value;

    public static readonly EventLevel Error = new EventLevel(1, "error");
    public static readonly EventLevel Warn = new EventLevel(2, "warn");
    public static readonly EventLevel Info = new EventLevel(3, "info");

    private EventLevel(int value, String name)
    {
        this.name = name;
        this.value = value;
    }

    public override String ToString()
    {
        return name;
    }
}