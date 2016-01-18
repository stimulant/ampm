
using System.ComponentModel;
using Newtonsoft.Json.Linq;
using AmpmLib;

namespace Client
{
    public class AppState : INotifyPropertyChanged
    {
        private static AppState _Instance;

        public static AppState Instance
        {
            get
            {
                if (_Instance == null)
                {
                    _Instance = new AppState();
                }

                return _Instance;
            }
        }

        private JToken _Config;

        public JToken Config
        {
            get
            {
                return _Config;
            }

            set
            {
                _Config = value;
                if (PropertyChanged != null)
                {
                    PropertyChanged(this, new PropertyChangedEventArgs("Config"));
                }
            }
        }

        public event PropertyChangedEventHandler PropertyChanged;
    }
}
