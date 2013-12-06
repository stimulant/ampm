using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shapes;
using Ampm;

namespace Client
{
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();

            if (ExhibitState.Instance.Config != null)
            {
                _Config.Text = ExhibitState.Instance.Config.ToString();
            }

            ExhibitState.Instance.ChangedRemotely += AppState_ChangedRemotely;
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            ExhibitState.Instance.MyState.Point = e.GetPosition(this);
            ExhibitState.Instance.FireChangedLocally();
            base.OnMouseMove(e);
        }

        void AppState_ChangedRemotely(object sender, EventArgs e)
        {
            foreach (Ellipse dot in _LayoutRoot.Children.Cast<Ellipse>().ToList())
            {
                if (!ExhibitState.Instance.AppStates.ContainsValue((AppState)dot.DataContext))
                {
                    _LayoutRoot.Children.Remove(dot);
                }
            }

            foreach (KeyValuePair<string, AppState> pair in ExhibitState.Instance.AppStates)
            {
                Ellipse dot = _LayoutRoot.Children.Cast<Ellipse>().FirstOrDefault(d => d.DataContext == pair.Value);
                if (dot == null)
                {
                    dot = new Ellipse
                    {
                        Width = 20,
                        Height = 20,
                        HorizontalAlignment = HorizontalAlignment.Left,
                        VerticalAlignment = VerticalAlignment.Top,
                        RenderTransform = new TranslateTransform(),
                        DataContext = pair.Value
                    };

                    _LayoutRoot.Children.Add(dot);
                }

                TranslateTransform translate = (TranslateTransform)dot.RenderTransform;
                translate.X = pair.Value.Point.X - dot.Width / 2;
                translate.Y = pair.Value.Point.Y - dot.Height / 2;

                dot.Fill = pair.Value.Color;
            }
        }

        private void Hang_Click(object sender, RoutedEventArgs e)
        {
            while (true)
            {
            }
        }

        private void Log_Click(object sender, RoutedEventArgs e)
        {
            Logger.Critical("critical!");
            Logger.Error("error!");
            Logger.Informational("informational!");
            Logger.Warning("warning!");
        }
    }
}
