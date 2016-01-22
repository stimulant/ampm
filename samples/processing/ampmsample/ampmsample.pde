import oscP5.*;

JSONObject config;
Ampm ampm;

void setup() {
  ampm = new Ampm(this);

  // load the JSON config file from ampm
  config = ampm.getConfig();

  ampm.info("info");
  ampm.warning("warn");
  ampm.error("error");
  ampm.logEvent("foo", "bar", "baz", 1);
}

void draw() {
  // send a heartbeat message every frame
  ampm.heart();
}

// Send mouse coordinates to the server to do things with
void mouseMoved() {
  JSONObject json = new JSONObject();
  json.setInt("x", mouseX);
  json.setInt("y", mouseY);
  OscMessage msg = new OscMessage("/mouse");
  msg.add(json.toString());
  ampm.sendOsc(msg);
}