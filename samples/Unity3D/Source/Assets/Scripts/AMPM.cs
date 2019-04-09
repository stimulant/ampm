using UnityEngine;
using System.Collections;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using UnityOSC;
using SimpleJSON;
using System.IO;


namespace AmpmLib
{
/// <summary>
/// Interface for sending things to ampm.
/// </summary>
public static class AMPM
{
	public delegate void ConfigLoadHandler();
	public static event ConfigLoadHandler OnConfigLoaded;

	private static bool _Connected = false;
	private static JSONNode _Config = null;

	public static event EventHandler<JSONNode> ConfigLoaded; //<JSONNode>
	public static event EventHandler<Tuple<string, JSONNode>> OnAmpmMessage;

	// The OSC server to receive OSC messages.
	private static readonly OSCServer _OscReceive;

	// The destination for OSC messages to the local node.js server.
	private static IPAddress ipAddress;

	private static Queue<Tuple<string, object>> _MessageQueue = new Queue<Tuple<string, object>>();


	static AMPM()
	{
		// Create a OSC Reciever to receive UDP messages
		_OscReceive = OSCHandler.Instance.CreateServer( "AMPM", 3003 );

		// Handle incoming OSC messages.
		_OscReceive.PacketReceivedEvent += Server_MessageReceived;

		ipAddress = GetLocalIPAddress();
		OSCHandler.Instance.CreateClient( "AMPM", ipAddress, 3002 ); // Creating a client to send messages on
	}

	public static IPAddress GetLocalIPAddress()
	{
		IPHostEntry host;

		try {
			host = Dns.GetHostEntry( Dns.GetHostName() ); // hostName );
		}
		catch( System.Net.Sockets.SocketException ex ) {
			Debug.Log( "WebSocket Exception: " + ex.Message );
			return new IPAddress( new byte[] { 127, 0, 0, 1 } );
		}

		foreach( var ip in host.AddressList ) {
			if( ip.AddressFamily == AddressFamily.InterNetwork ) {
				Debug.Log( "ip-> " + ip );
				return ip;
			}
		}

		throw new Exception( "Local IP Address Not Found!" );
	}
	public static void GetConfigFromUrl( string url = "http://localhost:8888/config" )
	{
		// load the url
		string strContent;
		var webRequest = WebRequest.Create( @url );
		using( var response = webRequest.GetResponse() )
		using( var content = response.GetResponseStream() )
		using( var reader = new StreamReader( content ) ) {
			strContent = reader.ReadToEnd();
		}

		// parse it as json
		_Config = JSON.Parse( strContent );

		// fire OnConfigLoaded
		if( OnConfigLoaded != null ) {
			OnConfigLoaded();
		}
	}
	/// <summary>
	/// unless using streaming assets, make sure the config file is in the build dir
	/// </summary>
	/// <param name="filename"></param>
	public static void GetConfigFromFile( string filename = "ampm.json" )
	{
		StreamReader reader = new StreamReader( filename );
		// parse it as json
		_Config = JSON.Parse( reader.ReadToEnd() );

		//Debug.Log( "_Config " + _Config.ToString() );

		// fire OnConfigLoaded
		if( OnConfigLoaded != null ) {
			OnConfigLoaded();
		}
	}

	/// <summary>
	/// Send a heartbeat message.
	/// </summary>
	public static void Heart()
	{
		UdpEvent( "heart" );
	}

	/// <summary>
	/// Log a usage event.
	/// </summary>
	/// <param name="category"></param>
	/// <param name="action"></param>
	/// <param name="label"></param>
	/// <param name="value"></param>
	public static void LogEvent( string category = null, string action = null, string label = null, int value = 0 )
	{
		TrackEvent e = new TrackEvent { Category = category, Action = action, Label = label, Value = value };
		SendEvent( e );
	}

	private static void LogMessage( EventLevel eventLevel, string message )
	{
		UdpEvent( "log", new { level = eventLevel.ToString(), message = message } );
	}

	/// <summary>
	/// Log an error.
	/// </summary>
	/// <param name="message"></param>
	public static void Error( string message )
	{
		LogMessage( EventLevel.Error, message );
	}

	/// <summary>
	/// Log a warning.
	/// </summary>
	/// <param name="message"></param>
	public static void Warn( string message )
	{
		LogMessage( EventLevel.Warn, message );
	}

	/// <summary>
	/// Log informational info.
	/// </summary>
	/// <param name="message"></param>
	public static void Info( string message )
	{
		LogMessage( EventLevel.Info, message );
	}

	private static void SendEvent( TrackEvent e )
	{
		UdpEvent( "event", e );
	}

	public static void UdpEvent( string name, object data = null )
	{
		name = "/" + name;

		if( data == null ) {
			OSCHandler.Instance.SendMessageToClient( "AMPM", name, "" );
		}
		else {
			string d = JsonUtility.ToJson( data );
			OSCHandler.Instance.SendMessageToClient( "AMPM", name, d );
		}
	}

	private static void Server_MessageReceived( OSCServer sender, OSCPacket e )
	{
		if( OnAmpmMessage == null ) {
			return;
		}

		string name = e.Address.Replace( "/", string.Empty );
		string json = e.Data.FirstOrDefault() as string;
		JSONNode data = null;

		if( json != null ) {
			data = JSON.Parse( json );
		}

		OnAmpmMessage( null, new Tuple<string, JSONNode>( name, data ) );
	}

	[Serializable]
	private class TrackEvent
	{
		public string Category;
		public string Action;
		public string Label;
		public int Value;
	}
}

}
