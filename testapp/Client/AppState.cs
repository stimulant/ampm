using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Media;

namespace Client
{
    public class AppState
    {
        public AppState()
        {
            Color = Brushes.Black;
        }

        /// <summary>
        /// The color to represent this client with.
        /// Ignored because it's a config setting, so no point sending it back to the server all the time.
        /// </summary>
        [ScriptIgnore]
        public Brush Color { get; set; }

        /// <summary>
        /// The location of this client.
        /// </summary>
        public Point Point { get; set; }
    }
}
