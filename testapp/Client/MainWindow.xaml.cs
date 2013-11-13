using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;
using System.Windows.Threading;
using Bespoke.Common.Osc;

namespace Client
{
    public partial class MainWindow : Window
    {
        private static readonly IPEndPoint Destination = new IPEndPoint(IPAddress.Loopback, 3001);
        private static readonly IPEndPoint Source = new IPEndPoint(IPAddress.Loopback, 2999);
        private static readonly DispatcherTimer Timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1.0 / 60.0) };
        
        public MainWindow()
        {
            InitializeComponent();
            Timer.Tick += Timer_Tick;
            Timer.Start();
        }

        void Timer_Tick(object sender, EventArgs e)
        {
            OscMessage message = new OscMessage(Source, "/heart/" + DateTime.Now.Millisecond);
            message.Send(Destination);
        }
    }
}
