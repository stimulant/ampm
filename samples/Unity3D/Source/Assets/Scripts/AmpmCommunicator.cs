using UnityEditor;
using UnityEditor.Callbacks;
using UnityEngine;
using System.Collections;
using AmpmLib;
using System.IO;

public class AmpmCommunicator : MonoBehaviour
{
	//public int sendPort = 3002;
	//public int recievePort = 3003;
	public float heartbeatInterval = 1 / 60;
	public string configFileName;

	// simple way to debug heartbeat
	private Color guiColor = new Color();

	// commi=unicator instance
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
		string pathString = Path.Combine( Application.streamingAssetsPath, configFileName );
		AMPM.GetConfigFromFile( pathString );
#endif
	}

	void ParseConfig()
	{
		// do stuff with the configuration
		StartHeartBeat();
	}

	void StartHeartBeat()
	{
		StopAllCoroutines();
		Debug.Log( "Starting App heartbeat" );
		StartCoroutine( "HeartNow" );
	}

	private IEnumerator HeartNow()
	{
		while( true ) {
			AMPM.Heart();
			guiColor = Random.ColorHSV();
			yield return new WaitForSeconds( heartbeatInterval );
		}
	}

	void OnGUI()
	{
		/* uncomment to debug heartbeat
		GUIStyle textStyle = new GUIStyle();
		textStyle.fontSize = 15;
		textStyle.normal.textColor = guiColor;
		GUI.color = guiColor;
		GUI.Label( new Rect( 10, 50, 100, 100 ), "PULSE", textStyle );
		*/
	}
}
