
#if UNITY_EDITOR
using UnityEditor;
#endif
//using UnityEditor.Callbacks;
using UnityEngine;
using System.Collections;
using AmpmLib;
using System.IO;

public class AmpmCommunicator : MonoBehaviour
{
	private int sendPort = 3002;
	private int recievePort = 3003;
	public float heartbeatInterval = 1 / 60;
	public string configFileName;
	public bool isDebug = false;

	// debug heartbeat
	private Color guiColor = new Color();

	// communicator instance
	static AmpmCommunicator instance = null;

	// create a singleton ampm communicator
	private void Awake()
	{
		if( instance == null ) {
			instance = this;
			DontDestroyOnLoad( gameObject );

		}
		else {
			if( this != instance ) {
				Destroy( gameObject );
			}
		}
	}

	// Use this for initialization
	void OnEnable()
	{
		AMPM.OnConfigLoaded += ParseConfig;
#if UNITY_STANDALONE && !UNITY_EDITOR
		AMPM.GetConfigFromUrl();
#else
		Debug.Log( "AMPM is running in editor mode !!!" );
		string pathString = Path.Combine( Application.streamingAssetsPath, configFileName );
		AMPM.GetConfigFromFile( pathString );
#endif
	}
	private void OnApplicationQuit()
	{
		Debug.Log( "closing AMPM" );
		AMPM.Close();
	}

	void ParseConfig()
	{
		// do stuff with the configuration
		StartHeartBeat();
	}

	void StartHeartBeat()
	{
		StopCoroutine( "HeartNow" );
		Debug.Log( "Starting App heartbeat" );
		StartCoroutine( "HeartNow" );
	}

	private IEnumerator HeartNow()
	{
		while( true ) {
			AMPM.Heart();
			guiColor = Random.ColorHSV();
			//Debug.Log( "sending App heartbeat" );
			yield return new WaitForSeconds( heartbeatInterval );
		}
	}

	void OnGUI()
	{
		if( isDebug ) {
			// simple debug display
			GUIStyle textStyle = new GUIStyle();
			textStyle.fontSize = 30;
			textStyle.normal.textColor = guiColor;
			GUI.color = guiColor;
			GUI.Label( new Rect( 20, 30 * 6 + 10, 100, 100 ), "PULSE", textStyle );
		}
	}
}
