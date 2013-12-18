
using System;
using System.Collections.Generic;
using System.Windows;
using Newtonsoft.Json.Linq;

namespace Client
{
    public class AppState
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

        private AppState()
        {
        }

        public JToken Config { get; set; }
    }
}
