import oscP5.*;
import netP5.*;

public class Ampm {
  PApplet app;
  OscP5 oscServer;
  NetAddress ampmOsc;
  
  // Set up ampm with the defaults
  public Ampm(PApplet app) {
    this.build(app, 3003, 3002);
  }
  
  // Customize settings
  public Ampm(PApplet app, int oscReceive, int oscSend) {
    this.build(app, oscReceive, oscSend);
  }
  
  private void build(PApplet app, int oscReceive, int oscSend) {
    this.app = app;
    oscServer = new OscP5(this, oscReceive); // set up OSC server
    ampmOsc = new NetAddress("127.0.0.1", oscSend); // ampm OSC target
  }
  
  // Get the configuration from the default url
  public JSONObject getConfig() {
    return this.getConfig("");
  }
  
  // Get the configuration from a different url
  public JSONObject getConfig(String url) {
    if(url == "") {
      url = "http://localhost:8888/config";
    }
    try {
      JSONObject config = this.app.loadJSONObject(url);
      return config;
    } catch(Exception e) {
      return new JSONObject();
    }
  }
  
  // Send a heartbeat message
  public void heart() {
    oscServer.send(new OscMessage("/heart"), ampmOsc);
  }
  
  // Send an analytics event
  public void logEvent(String category, String action, String label, int value) {
    JSONObject json = new JSONObject();
    json.setString("Category", category);
    json.setString("Action", action);
    json.setString("Label", label);
    json.setInt("Value", value);
    OscMessage msg = new OscMessage("/event");
    msg.add(json.toString());
    oscServer.send(msg, ampmOsc);
  }
  
  // Send a log message of a specific level
  public void logMessage(String eventLevel, String message) {
    JSONObject json = new JSONObject();
    json.setString("level", eventLevel);
    json.setString("message", message);
    OscMessage msg = new OscMessage("/log");
    msg.add(json.toString());
    oscServer.send(msg, ampmOsc);
  }
  
  // Send an arbitrary OSC message
  public void sendOsc(OscMessage msg) {
    oscServer.send(msg, ampmOsc);
  }
  
  // Send an error message
  public void error(String message) {
    this.logMessage("error", message);
  }
  
  // Send a warning message
  public void warning(String message) {
    this.logMessage("warn", message);
  }
 
  // Send an info message
  public void info(String message) {
    this.logMessage("info", message);
  }
}