
using System;
using System.Collections.Generic;
using System.Windows;
using Newtonsoft.Json.Linq;

namespace Client
{
    public class ExhibitState
    {
        private static ExhibitState _Instance;

        public static ExhibitState Instance
        {
            get
            {
                if (_Instance == null)
                {
                    _Instance = new ExhibitState();
                }

                return _Instance;
            }
        }

        private ExhibitState()
        {
            AppStates = new Dictionary<string, AppState>();
            AppStates[Environment.MachineName] = new AppState { Point = new Point() };
        }

        public JToken Config { get; set; }

        public Dictionary<string, AppState> AppStates { get; set; }

        public AppState MyState
        {
            get
            {
                return AppStates[Environment.MachineName];
            }
        }

        public event EventHandler ChangedLocally;

        public void FireChangedLocally()
        {
            if (ChangedLocally != null)
            {
                ChangedLocally(this, EventArgs.Empty);
            }
        }

        public event EventHandler ChangedRemotely;

        public void FireChangedRemotely()
        {
            if (ChangedRemotely != null)
            {
                ChangedRemotely(this, EventArgs.Empty);
            }
        }
    }
}
