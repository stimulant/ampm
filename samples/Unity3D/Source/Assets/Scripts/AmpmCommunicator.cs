using UnityEngine;
using System.Collections;
using AmpmLib;

public class AmpmCommunicator : MonoBehaviour {

	// Use this for initialization
	void OnEnable () {
		AMPM.OnConfigLoaded += ParseConfig;
		AMPM.GetConfig ();
	}

	void ParseConfig(){ 
		// do stuff with the configuration
		StartHeartBeat();
	}

	void StartHeartBeat ()
	{
		StopAllCoroutines ();
		Debug.Log("Starting App heartbeat");
		StartCoroutine ("HeartNow");
	}

	private IEnumerator HeartNow(){
		while (true) {
			AMPM.Heart ();
			yield return new WaitForSeconds ((1/60));
		}
	}
}
