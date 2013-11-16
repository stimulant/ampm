using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shapes;

namespace Client
{
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
            AppState.Instance.ChangedRemotely += AppState_ChangedRemotely;
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            AppState.Instance.MyState.Point = e.GetPosition(this);
            AppState.Instance.FireChangedLocally();
            base.OnMouseMove(e);
        }

        void AppState_ChangedRemotely(object sender, EventArgs e)
        {
            foreach (Ellipse dot in _LayoutRoot.Children.Cast<Ellipse>().ToList())
            {
                if (!AppState.Instance.ClientStates.ContainsValue((ClientState)dot.DataContext))
                {
                    _LayoutRoot.Children.Remove(dot);
                }
            }

            foreach (KeyValuePair<string, ClientState> pair in AppState.Instance.ClientStates)
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
    }
}
